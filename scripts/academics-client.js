import { BaseSyncClient, stampData, readJsonFile } from "./base-sync-client";

/**
 * Academics Sync Client
 * Synchronizes academics data to Supabase
 */
class AcademicsSyncClient extends BaseSyncClient {
  calculateGPA(courses) {
    if (!courses || courses.length === 0) return 0;

    const gradePoints = {
      A: 4.0,
      "A-": 3.7,
      B: 3.0,
      "B-": 2.7,
      C: 2.0,
      D: 1.0,
      F: 0.0,
    };

    let totalPoints = 0;
    let totalCredits = 0;

    courses.forEach((course) => {
      if (course.grade && gradePoints[course.grade]) {
        totalPoints += gradePoints[course.grade] * course.credits;
        totalCredits += course.credits;
      }
    });

    return totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;
  }

  getCurrentTerm(calendar) {
    const today = new Date();
    const terms = calendar.terms || [];

    for (const term of terms) {
      const start = new Date(term.start);
      const end = new Date(term.end);
      if (today >= start && today <= end) {
        return term.term;
      }
    }

    return terms.length > 0 ? terms[terms.length - 1].term : 1;
  }

  async sync(filePath) {
    console.log(`📚 Syncing academics from ${filePath}...`);

    const data = await readJsonFile(filePath);
    this.validateSchema(data, {});

    // Calculate GPA
    const currentGPA = this.calculateGPA(data.courses);
    data.gpa.current = currentGPA;

    // Update current term
    data.current_term = this.getCurrentTerm(data.academic_calendar);

    const payload = stampData(data);

    await this.upsertData(payload);
    console.log(`✅ Academics synced successfully (GPA: ${currentGPA})`);
  }
}

// Main execution
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.ACADEMICS_USER_ID || "ntobeko-academics";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const client = new AcademicsSyncClient(supabaseUrl, serviceRoleKey, userId);
const filePath = process.argv[3] || "docs/academics.json";

client
  .sync(filePath)
  .catch((error) => {
    console.error("Sync failed:", error.message);
    process.exit(1);
  });
