// Supabase Edge Function: fetch-nedbank-transactions
// Deploy this after getting Stitch API credentials

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Stitch credentials from environment
    const stitchClientId = Deno.env.get('STITCH_CLIENT_ID')
    const stitchClientSecret = Deno.env.get('STITCH_CLIENT_SECRET')
    
    if (!stitchClientId || !stitchClientSecret) {
      throw new Error('Stitch credentials not configured. Add STITCH_CLIENT_ID and STITCH_CLIENT_SECRET to environment.')
    }

    // Step 1: Get OAuth token from Stitch
    console.log('Getting Stitch OAuth token...')
    const tokenResponse = await fetch('https://api.stitch.money/graphql', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation ClientTokenCreate($input: ClientTokenCreateInput!) {
            clientTokenCreate(input: $input) {
              token
            }
          }
        `,
        variables: {
          input: {
            clientId: stitchClientId,
            clientSecret: stitchClientSecret,
            grantType: "client_credentials"
          }
        }
      })
    })

    if (!tokenResponse.ok) {
      throw new Error(`Stitch auth failed: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    
    if (tokenData.errors) {
      throw new Error(`Stitch auth error: ${JSON.stringify(tokenData.errors)}`)
    }

    const token = tokenData.data?.clientTokenCreate?.token
    
    if (!token) {
      throw new Error('No token received from Stitch')
    }

    console.log('Token received, fetching transactions...')

    // Step 2: Fetch transactions from Nedbank via Stitch
    const transactionsResponse = await fetch('https://api.stitch.money/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            user {
              bankAccounts {
                accountNumber
                accountName
                accountType
                currentBalance
                availableBalance
                transactions(first: 100) {
                  edges {
                    node {
                      id
                      date
                      description
                      amount
                      runningBalance
                    }
                  }
                }
              }
            }
          }
        `
      })
    })

    if (!transactionsResponse.ok) {
      throw new Error(`Transactions fetch failed: ${transactionsResponse.status}`)
    }

    const transactionsData = await transactionsResponse.json()
    
    if (transactionsData.errors) {
      throw new Error(`Transactions error: ${JSON.stringify(transactionsData.errors)}`)
    }

    const bankAccounts = transactionsData.data?.user?.bankAccounts
    
    if (!bankAccounts || bankAccounts.length === 0) {
      throw new Error('No bank accounts found. Make sure Nedbank is linked in Stitch.')
    }

    console.log(`Found ${bankAccounts.length} bank account(s)`)

    // Process all accounts
    const allAccounts = bankAccounts.map((account, index) => ({
      accountNumber: account.accountNumber,
      accountName: account.accountName || `Account ${index + 1}`,
      accountType: account.accountType || 'Cheque',
      balance: parseFloat(account.currentBalance),
      availableBalance: parseFloat(account.availableBalance)
    }))

    // Get transactions from all accounts
    let allTransactions = []
    for (const account of bankAccounts) {
      const transactions = account.transactions?.edges || []
      allTransactions = allTransactions.concat(transactions.map(({ node }) => ({
        ...node,
        accountNumber: account.accountNumber
      })))
    }

    console.log(`Fetched ${allTransactions.length} transactions from ${bankAccounts.length} account(s)`)

    // Step 3: Transform transactions to ledger format
    const formattedTransactions = allTransactions.map((node) => ({
      type: parseFloat(node.amount) > 0 ? 'income' : 'expense',
      desc: node.description,
      amt: Math.abs(parseFloat(node.amount)),
      cat: categorizeTransaction(node.description),
      date: node.date,
      accountNumber: node.accountNumber, // Track which account
      stitchId: node.id // Store to prevent duplicates
    }))

    // Step 4: Merge with existing ledger in Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: existing, error: fetchError } = await supabase
      .from('estate_data')
      .select('data')
      .eq('user_id', 'ntobeko-masemula-estate')
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found, which is ok
      throw new Error(`Failed to fetch existing data: ${fetchError.message}`)
    }

    const currentLedger = existing?.data?.financeLedger || []
    
    // Deduplicate: only add transactions not already in ledger
    const existingIds = new Set(currentLedger.map(t => t.stitchId).filter(Boolean))
    const newTransactions = formattedTransactions.filter(t => !existingIds.has(t.stitchId))

    console.log(`${newTransactions.length} new transactions to add`)

    // Merge: new transactions at the front
    const mergedLedger = [...newTransactions, ...currentLedger]

    // Step 5: Save back to Supabase
    const { error: updateError } = await supabase
      .from('estate_data')
      .update({ 
        data: { 
          ...(existing?.data || {}),
          financeLedger: mergedLedger 
        },
        updated_at: new Date().toISOString()
      })
      .eq('user_id', 'ntobeko-masemula-estate')

    if (updateError) {
      throw new Error(`Failed to update ledger: ${updateError.message}`)
    }

    console.log('Sync complete!')

    return new Response(
      JSON.stringify({ 
        success: true, 
        newTransactions: newTransactions.length,
        totalTransactions: mergedLedger.length,
        accounts: allAccounts // Return all accounts
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (err) {
    console.error('Error:', err)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function categorizeTransaction(description) {
  const desc = description.toLowerCase()
  
  // Dropshipping
  if (desc.includes('shopify') || desc.includes('store') || desc.includes('shop')) {
    return 'Dropshipping'
  }
  
  // Music
  if (desc.includes('spotify') || desc.includes('apple music') || desc.includes('distrokid') || 
      desc.includes('tunecore') || desc.includes('landr') || desc.includes('cd baby')) {
    return 'Music'
  }
  
  // Ads
  if (desc.includes('facebook') || desc.includes('meta') || desc.includes('google ads') || 
      desc.includes('tiktok') || desc.includes('advertising')) {
    return 'Ads'
  }
  
  // Tools/Software
  if (desc.includes('adobe') || desc.includes('canva') || desc.includes('figma') || 
      desc.includes('subscription') || desc.includes('saas') || desc.includes('software')) {
    return 'Tools'
  }
  
  // Brand
  if (desc.includes('masemula') || desc.includes('clothing') || desc.includes('fashion')) {
    return 'Masemula Brand'
  }
  
  return 'Other'
}
