/* =========================================================
   UGBS Academic Advising & Student Progress Support
   Aligned to the Python reference system:
     - rag.py   → KNOWLEDGE_BASE + retrieval engine (BM25 + cosine)
     - tools.py → STUDENT data + rule-based classifier
     - agent.py → intent router + composer
   All logic runs client-side. No network calls, no LLM API.
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     1. KNOWLEDGE BASE
     Mirrors rag.py: three documents, each chunked on blank
     lines into paragraph-sized passages. Source titles are
     human-readable (not filenames) so citations read well.
     ========================================================= */

  const KB_DOCS = [
    {
      source: "Course Descriptions",
      text: `COURSE DESCRIPTIONS
Data Science and Business Analytics Department, UGBS

OMIS 201: Business Data Analysis
Introduces students to the process of collecting, cleaning, and analyzing business data to support decision-making, using spreadsheet and introductory statistical tools. Builds directly on OMIS 104 and STAT 111.

OMIS 204: Database Management Systems
Covers relational database design, SQL, normalization, and the role of databases in business information systems. Considered a foundational course for most Year 3 and Year 4 electives involving data infrastructure.

OMIS 301: Data Mining and Machine Learning
Introduces supervised and unsupervised machine learning techniques (classification, clustering, regression) and their application to business problems such as customer segmentation and demand prediction. This is a gateway course: most Year 4 courses (OMIS 401, OMIS 404, OMIS 407) require it as a prerequisite.

OMIS 404: AI Applications in Business
Examines how organizations design, build, and evaluate AI-enabled systems for real business and administrative problems, including generative AI, AI agents, and analytical decision support. Includes a term project applying these concepts to a practical scenario.

OMIS 410: Long Essay / Capstone Project
An independent research project completed in the final year, supervised by a faculty member, applying data science or business analytics methods to a real or realistic business problem. Requires completion of all Year 3 core courses before registration.

OMIS 415: Natural Language Processing for Business Applications (Elective)
Covers techniques for extracting insight from unstructured text data (customer reviews, support tickets, social media) and applying them to business contexts. Builds on the machine learning foundations from OMIS 301.

OMIS 420: Digital Transformation Strategy (Elective)
Examines how organizations plan and manage large-scale technology-driven change, with case studies from various industries. Open to all Year 3 and Year 4 students in good academic standing.`
    },
    {
      source: "Programme Structure",
      text: `DATA SCIENCE AND BUSINESS ANALYTICS PROGRAMME STRUCTURE
University of Ghana Business School (UGBS)

Each academic year, students are expected to complete 32 credit hours (16 credits per semester) to remain on track for graduation in four years.

YEAR 1 CORE COURSES (32 credits)
OMIS 101: Introduction to Information Systems (4 credits). No prerequisite.
OMIS 104: Fundamentals of Computing (4 credits). No prerequisite.
STAT 111: Introduction to Statistics (4 credits). No prerequisite.
ACCT 101: Principles of Accounting I (4 credits). No prerequisite.
Remaining credits made up of general education and elective courses.

YEAR 2 CORE COURSES (32 credits)
OMIS 201: Business Data Analysis (4 credits). Prerequisite: OMIS 104 and STAT 111.
OMIS 204: Database Management Systems (4 credits). Prerequisite: OMIS 101.
STAT 212: Probability and Statistical Inference (4 credits). Prerequisite: STAT 111.
OMIS 210: Systems Analysis and Design (4 credits). Prerequisite: OMIS 101.

YEAR 3 CORE COURSES (32 credits)
OMIS 301: Data Mining and Machine Learning (4 credits). Prerequisite: OMIS 201 and STAT 212.
OMIS 305: Business Process Management (4 credits). Prerequisite: OMIS 210.
OMIS 308: Enterprise Resource Planning Systems (4 credits). Prerequisite: OMIS 204.
STAT 314: Applied Regression Analysis (4 credits). Prerequisite: STAT 212.

YEAR 4 CORE COURSES (32 credits)
OMIS 401: Big Data Analytics (4 credits). Prerequisite: OMIS 301.
OMIS 404: AI Applications in Business (4 credits). Prerequisite: OMIS 301.
OMIS 407: Business Intelligence and Decision Support Systems (4 credits). Prerequisite: OMIS 301 and OMIS 305.
OMIS 410: Long Essay / Capstone Project (4 credits). Prerequisite: Completion of all Year 3 core courses.

ELECTIVE COURSES
OMIS 320: Cloud Computing for Business (4 credits). Prerequisite: OMIS 204.
OMIS 330: Cybersecurity Fundamentals (4 credits). Prerequisite: OMIS 204.
OMIS 415: Natural Language Processing for Business Applications (4 credits). Prerequisite: OMIS 301.
OMIS 420: Digital Transformation Strategy (4 credits). No additional prerequisite beyond Year 3 standing.

NOTES ON CROSS-DEPARTMENT COURSES
Students taking electives outside the department (e.g. Finance, Marketing) must confirm seat availability and prerequisite compatibility directly with the offering department, as those prerequisites are not administered by Data Science and Business Analytics.`
    },
    {
      source: "Progression Rules",
      text: `ACADEMIC PROGRESSION RULES
Data Science and Business Analytics Department, UGBS

MINIMUM CUMULATIVE GPA TO PROGRESS
Students must maintain a cumulative GPA of at least 1.50 to be allowed to progress to the next academic year without restriction. A student whose cumulative GPA falls below 1.50 at the end of any academic year is placed on academic probation.

ACADEMIC PROBATION
A student on academic probation must meet with their assigned academic advisor before the start of the next semester to agree an improvement plan. A student on probation for two consecutive years may be required to withdraw from the programme, subject to Faculty Board review.

FAILED CORE COURSES
A core course must be passed with a grade of D or better to count toward progression. A student who fails a core course must retake that course the next time it is offered. A student cannot proceed to a course for which the failed course is a prerequisite until the failed course has been passed. Example: a student who fails OMIS 204 cannot enrol in OMIS 308 or OMIS 320 until OMIS 204 has been retaken and passed.

RETAKE POLICY
A core course may be retaken a maximum of two times. A student who fails a core course a third time will be referred to the Head of Department for academic counselling and an individualized progression plan.

CREDIT REQUIREMENTS FOR GRADUATION
A minimum of 128 credit hours must be completed across all four years to be eligible for graduation, including all core courses and the Year 4 Capstone Project (OMIS 410). Students who are more than 8 credit hours behind their expected cumulative total for their year are considered at risk of delayed graduation and should consult their advisor.

DEFERMENT AND WITHDRAWAL
A student wishing to defer a semester or withdraw from the programme must submit a formal request to the Dean of Academic Affairs, copied to their departmental advisor, at least two weeks before the start of the semester in question except in documented emergency cases.`
    }
  ];

  // ---- Chunking (mirrors rag.py chunk_document) --------------
  function chunkDocument(doc) {
    const raw = doc.text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const chunks = [];
    raw.forEach((chunk, i) => {
      if (chunk.length < 20) return;
      chunks.push({
        id: `${doc.source.replace(/\s+/g, "_").toLowerCase()}_${i}`,
        text: chunk,
        source: doc.source
      });
    });
    return chunks;
  }

  const KNOWLEDGE_BASE = KB_DOCS.flatMap(chunkDocument);

  /* =========================================================
     2. RETRIEVAL ENGINE
     BM25-style scoring + IDF-weighted cosine on the same
     token stream. Adds:
       - phrase boost for course codes (OMIS 301 etc.)
       - synonym expansion for common asking patterns
     Achieves embedding-like recall without any model download.
     ========================================================= */

  const STOPWORDS = new Set([
    "a","an","the","is","are","was","were","be","been","being","to","of","in","on","for",
    "and","or","but","if","then","so","do","does","did","i","my","me","we","our","you",
    "your","it","its","this","that","these","those","can","could","should","would","will",
    "shall","may","might","must","have","has","had","not","no","with","at","by","from",
    "about","into","as","up","out","what","which","who","when","where","how","also","than",
    "there","their","them","he","she","him","her","am","there's","im","ive"
  ]);

  // Synonym map so "deferment" matches "defer", "GPA" matches "grade point", etc.
  const SYNONYMS = {
    deferment: ["defer", "postpone", "suspend", "leave"],
    defer: ["deferment", "postpone", "suspend"],
    gpa: ["grade", "point", "average", "cgpa"],
    cgpa: ["gpa", "grade", "average"],
    prerequisite: ["prereq", "prerequisites", "prereqs", "requires", "required"],
    prereq: ["prerequisite", "prerequisites", "requires"],
    retake: ["repeat", "resit", "failed", "fail", "retaking"],
    fail: ["failed", "failing", "retake", "resit"],
    probation: ["probationary", "warned", "warning"],
    credits: ["credit", "hours", "credit-hours"],
    graduation: ["graduate", "graduating", "capstone"],
    withdraw: ["withdrawal", "withdrawing"],
    elective: ["electives", "option", "optional"]
  };

  function expandTokens(tokens) {
    const out = new Set(tokens);
    tokens.forEach(t => {
      (SYNONYMS[t] || []).forEach(syn => out.add(syn));
    });
    return Array.from(out);
  }

  function tokenize(text) {
    const raw = (text.toLowerCase().match(/[a-z0-9]+/g) || []);
    const kept = raw.filter(t => t.length > 1 && !STOPWORDS.has(t));
    return expandTokens(kept);
  }

  // Pre-compute per-chunk token stats once.
  const CHUNKS = KNOWLEDGE_BASE.map(chunk => {
    const tokens = tokenize(chunk.text + " " + chunk.source);
    const tf = {};
    tokens.forEach(t => (tf[t] = (tf[t] || 0) + 1));
    // Extract course codes like OMIS 301, STAT 212 for phrase boost.
    const codes = (chunk.text.match(/\b[A-Z]{2,4}\s?\d{3}\b/g) || [])
      .map(c => c.replace(/\s+/g, " ").toUpperCase());
    return { ...chunk, tokens, tf, len: tokens.length, codes };
  });

  // IDF across the corpus.
  const idf = {};
  (function buildIDF() {
    const N = CHUNKS.length;
    const df = {};
    CHUNKS.forEach(c => {
      new Set(c.tokens).forEach(t => (df[t] = (df[t] || 0) + 1));
    });
    Object.keys(df).forEach(t => {
      idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1;
    });
  })();

  const AVG_LEN = CHUNKS.reduce((a, c) => a + c.len, 0) / CHUNKS.length || 1;
  const K1 = 1.4; // BM25 term-frequency saturation
  const B = 0.7;  // BM25 length normalisation

  function scoreChunk(chunk, queryTokens, queryCodeSet) {
    // --- BM25 component ---
    let bm25 = 0;
    const seen = new Set(queryTokens);
    seen.forEach(t => {
      const freq = chunk.tf[t] || 0;
      if (!freq) return;
      const idfT = idf[t] || 0.5;
      const denom = freq + K1 * (1 - B + B * (chunk.len / AVG_LEN));
      bm25 += idfT * (freq * (K1 + 1)) / denom;
    });

    // --- Phrase boost: if the query mentions a course code that lives in this chunk ---
    let phraseBoost = 0;
    if (queryCodeSet.size) {
      chunk.codes.forEach(code => {
        if (queryCodeSet.has(code)) phraseBoost += 2.5;
      });
    }

    // --- Source-title boost (a question about "progression" should prefer the
    //     document titled "Progression Rules") ---
    let titleBoost = 0;
    const titleTokens = new Set(tokenize(chunk.source));
    titleTokens.forEach(t => {
      if (seen.has(t)) titleBoost += 0.8;
    });

    return bm25 + phraseBoost + titleBoost;
  }

  function extractCourseCodes(text) {
    const out = new Set();
    (text.match(/\b[A-Z]{2,4}\s?\d{3}\b/g) || []).forEach(c => {
      out.add(c.replace(/\s+/g, " ").toUpperCase());
    });
    return out;
  }

  const RETRIEVE_THRESHOLD = 3.0; // tuned so clearly-off-topic questions fall through

  function retrieve(query, n = 3) {
    const qTokens = tokenize(query);
    const qCodes = extractCourseCodes(query);
    const scored = CHUNKS
      .map(c => ({ chunk: c, score: scoreChunk(c, qTokens, qCodes) }))
      .sort((a, b) => b.score - a.score);
    const top = scored[0];
    if (!top || top.score < RETRIEVE_THRESHOLD) return [];
    return scored.slice(0, n).filter(s => s.score >= RETRIEVE_THRESHOLD * 0.5);
  }

  /* =========================================================
     3. STUDENT DATA + RULE-BASED TOOL
     Mirrors tools.py exactly: same thresholds, same logic.
     ========================================================= */

  const MIN_GPA_TO_PROGRESS = 1.50;
  const BORDERLINE_GPA_CEILING = 2.00;
  const MAX_CREDIT_SHORTFALL_AT_RISK = 8;
  const MAX_CREDIT_SHORTFALL_BORDERLINE = 4;
  const GPA_DECLINE_THRESHOLD = 0.5;

  // Synthetic students matching the Python dataset shape. Includes a few
  // students from the web prototype plus new ones to exercise the new logic.
  const STUDENT_RECORDS = [
    { student_id: "10910001", name: "Ama Serwaa Mensah",    year: 4, advisor: "Dr. Ohene-Asare", sem_gpas: [3.55, 3.60, 3.68, 3.65], cumulative_gpa: 3.62, failed_courses: [], credits_completed: 128, credits_required_to_date: 128 },
    { student_id: "10910002", name: "Kwame Asante Boateng", year: 3, advisor: "Dr. Nyarko",       sem_gpas: [3.20, 3.15, 3.20, 3.17], cumulative_gpa: 3.18, failed_courses: ["OMIS 204"], credits_completed: 92, credits_required_to_date: 96 },
    { student_id: "10910003", name: "Mary Adwoa Appiah",    year: 3, advisor: "Dr. Ansah",        sem_gpas: [2.60, 2.45, 2.35, 2.24], cumulative_gpa: 2.41, failed_courses: ["OMIS 201"], credits_completed: 88, credits_required_to_date: 96 },
    { student_id: "10910004", name: "Daniel Kofi Mensah",   year: 2, advisor: "Mrs. Aryeetey",    sem_gpas: [3.10, 3.05, 3.00, 3.05], cumulative_gpa: 3.05, failed_courses: [], credits_completed: 62, credits_required_to_date: 64 },
    { student_id: "10910005", name: "Esi Yeboah",           year: 2, advisor: "Dr. Nyarko",       sem_gpas: [3.40, 3.50, 3.48, 3.52], cumulative_gpa: 3.48, failed_courses: [], credits_completed: 64, credits_required_to_date: 64 },
    { student_id: "10910006", name: "Yaw Owusu Ansah",      year: 3, advisor: "Dr. Ansah",        sem_gpas: [1.60, 1.45, 1.20, 1.15], cumulative_gpa: 1.35, failed_courses: ["OMIS 204", "OMIS 301"], credits_completed: 68, credits_required_to_date: 96 },
    { student_id: "10910007", name: "Adwoa Nhyira Adjei",   year: 4, advisor: "Dr. Ohene-Asare",  sem_gpas: [3.80, 3.75, 3.85, 3.80], cumulative_gpa: 3.80, failed_courses: [], credits_completed: 124, credits_required_to_date: 128 },
    { student_id: "10910008", name: "Kojo Frimpong Tetteh", year: 2, advisor: "Mrs. Aryeetey",    sem_gpas: [2.05, 2.00, 1.90, 1.85], cumulative_gpa: 1.95, failed_courses: ["OMIS 104"], credits_completed: 48, credits_required_to_date: 64 },
    { student_id: "10910009", name: "Nana Akua Osei",       year: 3, advisor: "Dr. Nyarko",       sem_gpas: [3.30, 3.35, 3.40, 3.38], cumulative_gpa: 3.36, failed_courses: [], credits_completed: 94, credits_required_to_date: 96 },
    { student_id: "10910010", name: "Kofi Amankwah Darko",  year: 4, advisor: "Dr. Ansah",        sem_gpas: [2.20, 2.10, 2.00, 1.95], cumulative_gpa: 2.06, failed_courses: ["OMIS 308"], credits_completed: 96, credits_required_to_date: 128 }
  ];

  function classifyStudent(s) {
    const reasons = [];
    let status = "on_track";

    const creditsBehind = s.credits_required_to_date - s.credits_completed;
    const gpaDrop = s.sem_gpas[0] - s.sem_gpas[s.sem_gpas.length - 1];

    if (s.cumulative_gpa < MIN_GPA_TO_PROGRESS) {
      status = "at_risk";
      reasons.push(
        `Cumulative GPA ${s.cumulative_gpa.toFixed(2)} is below the ${MIN_GPA_TO_PROGRESS.toFixed(2)} progression threshold (academic probation).`
      );
    }

    if (s.failed_courses.length >= 2) {
      status = "at_risk";
      reasons.push(
        `${s.failed_courses.length} core courses failed (${s.failed_courses.join(", ")}); retake policy allows a maximum of two attempts before Head of Department referral.`
      );
    }

    if (creditsBehind > MAX_CREDIT_SHORTFALL_AT_RISK) {
      status = "at_risk";
      reasons.push(
        `${creditsBehind} credit hours behind the expected total for Year ${s.year}, exceeding the ${MAX_CREDIT_SHORTFALL_AT_RISK}-credit threshold for delayed-graduation risk.`
      );
    }

    if (status !== "at_risk") {
      if (s.cumulative_gpa < BORDERLINE_GPA_CEILING) {
        status = "borderline";
        reasons.push(
          `Cumulative GPA ${s.cumulative_gpa.toFixed(2)} is low enough to warrant monitoring, though still above the probation threshold.`
        );
      }
      if (s.failed_courses.length === 1) {
        status = "borderline";
        reasons.push(
          `One core course failed (${s.failed_courses[0]}); should be retaken at the next opportunity.`
        );
      }
      if (creditsBehind > MAX_CREDIT_SHORTFALL_BORDERLINE) {
        status = "borderline";
        reasons.push(
          `${creditsBehind} credit hours behind the expected total for Year ${s.year}.`
        );
      }
      if (gpaDrop > GPA_DECLINE_THRESHOLD) {
        status = "borderline";
        reasons.push(
          `GPA has declined by ${gpaDrop.toFixed(2)} points from semester 1 (${s.sem_gpas[0].toFixed(2)}) to semester ${s.sem_gpas.length} (${s.sem_gpas[s.sem_gpas.length - 1].toFixed(2)}), a downward trend worth discussing even though the current GPA is not yet critical.`
        );
      }
    }

    if (!reasons.length) {
      reasons.push("No progression rule thresholds triggered; performance is on track.");
    }
    return { status, reasons };
  }

  function toolCheckStudentProgress(studentId) {
    const s = STUDENT_RECORDS.find(r => r.student_id === String(studentId));
    if (!s) return { found: false, error: `No student found with ID ${studentId}.` };
    const { status, reasons } = classifyStudent(s);
    return {
      found: true,
      student_id: s.student_id,
      name: s.name,
      year: s.year,
      advisor: s.advisor,
      cumulative_gpa: s.cumulative_gpa,
      status,
      reasons
    };
  }

  function toolListAtRiskStudents(includeBorderline = true) {
    const results = [];
    STUDENT_RECORDS.forEach(s => {
      const { status, reasons } = classifyStudent(s);
      if (status === "at_risk" || (includeBorderline && status === "borderline")) {
        results.push({
          student_id: s.student_id,
          name: s.name,
          year: s.year,
          advisor: s.advisor,
          cumulative_gpa: s.cumulative_gpa,
          status,
          reasons
        });
      }
    });
    const order = { at_risk: 0, borderline: 1 };
    results.sort((a, b) =>
      order[a.status] - order[b.status] || a.cumulative_gpa - b.cumulative_gpa
    );
    return results;
  }

  /* =========================================================
     4. AGENT — intent router + composer
     Mirrors agent.py's function-calling decision logic:
       - detect a student ID          → check_student_progress
       - detect an advisor roll-up    → list_at_risk_students
       - otherwise                    → retrieve_knowledge_base
     May combine retrieval with a tool call for context.
     ========================================================= */

  const ADVISOR_PHRASES = [
    "who needs attention", "who is at risk", "who's at risk",
    "at-risk list", "at risk list", "list of students",
    "which students", "show me students", "students needing",
    "students who need", "flagged students", "watch list"
  ];

  const STUDENT_ID_RE = /\b(10\d{6})\b/;

  function classifyIntent(text) {
    const lower = text.toLowerCase();
    const idMatch = text.match(STUDENT_ID_RE);

    if (idMatch) {
      return { intent: "check_student", studentId: idMatch[1] };
    }
    if (ADVISOR_PHRASES.some(p => lower.includes(p))) {
      return { intent: "list_at_risk" };
    }
    return { intent: "retrieve" };
  }

  function composeAnswer({ intent, studentId, question }) {
    // ---- check a specific student's progress ----
    if (intent === "check_student") {
      const result = toolCheckStudentProgress(studentId);
      if (!result.found) {
        return {
          text: `I couldn't find a student with ID ${studentId} in the department's records. Please double-check the ID and try again.`,
          sources: [],
          declined: true
        };
      }
      const header = `**${result.name}** (${result.student_id}) — Year ${result.year} — Advisor: ${result.advisor}\n` +
                     `Cumulative GPA: **${result.cumulative_gpa.toFixed(2)}** — Status: **${result.status.replace("_", " ").toUpperCase()}**\n\n`;
      const bullets = result.reasons.map(r => `• ${r}`).join("\n");
      return {
        text: header + bullets,
        sources: ["Rule-based progress classifier"],
        declined: false
      };
    }

    // ---- list at-risk students ----
    if (intent === "list_at_risk") {
      const list = toolListAtRiskStudents();
      if (!list.length) {
        return {
          text: "No students are currently flagged as at risk or borderline. Everyone is on track.",
          sources: ["Rule-based progress classifier"],
          declined: false
        };
      }
      const atRisk = list.filter(s => s.status === "at_risk").length;
      const borderline = list.filter(s => s.status === "borderline").length;
      const lines = list.map((s, i) =>
        `${i + 1}. ${s.name} (${s.student_id}, Year ${s.year}) — ${s.status.replace("_", " ").toUpperCase()}, GPA ${s.cumulative_gpa.toFixed(2)}`
      );
      return {
        text:
          `${list.length} student${list.length === 1 ? "" : "s"} flagged: ${atRisk} at risk, ${borderline} borderline.\n\n` +
          lines.join("\n"),
        sources: ["Rule-based progress classifier"],
        declined: false
      };
    }

    // ---- default: retrieve from the knowledge base ----
    const hits = retrieve(question, 3);
    if (!hits.length) {
      return {
        text:
          "I don't have information on that in the department's programme documents, so I won't guess. " +
          "Please contact your academic advisor or the department office directly — they'll be able to give you an accurate answer.",
        sources: [],
        declined: true
      };
    }
    const body = hits.map(h => h.chunk.text).join("\n\n");
    const sources = Array.from(new Set(hits.map(h => h.chunk.source)));
    return { text: body, sources, declined: false };
  }

  function answerQuestion(question) {
    const routed = classifyIntent(question);
    return composeAnswer({ ...routed, question });
  }

  /* =========================================================
     5. ICONS
     ========================================================= */
  const ICONS = {
    bot: '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 4h6M9 14h.01M15 14h.01"/></svg>',
    user: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>',
    doc: '<svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    alert: '<svg class="icon" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01"/></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    cross: '<svg class="icon" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    chevron: '<svg class="icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    sparkle: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/></svg>'
  };

  /* =========================================================
     6. AUTHENTICATION
     ========================================================= */
  const ACCOUNTS = {
    student: [
      { username: "ama",    password: "ugbs2026", name: "Ama Serwaa Mensah",    studentId: "10910001" },
      { username: "kwame",  password: "ugbs2026", name: "Kwame Asante Boateng", studentId: "10910002" },
      { username: "mary",   password: "ugbs2026", name: "Mary Adwoa Appiah",    studentId: "10910003" },
      { username: "daniel", password: "ugbs2026", name: "Daniel Kofi Mensah",   studentId: "10910004" },
      { username: "esi",    password: "ugbs2026", name: "Esi Yeboah",           studentId: "10910005" },
      { username: "yaw",    password: "ugbs2026", name: "Yaw Owusu Ansah",      studentId: "10910006" }
    ],
    advisor: [
      { username: "zaydan", password: "advisor2026", name: "Zaydan Abass", title: "Academic Advisor" },
      { username: "admin",  password: "advisor2026", name: "Demo Advisor", title: "Senior Advisor" }
    ]
  };

  const SESSION_KEY = "ugbs.advising.session";
  const AUTH_ICONS = {
    student: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>',
    advisor: '<svg class="icon" viewBox="0 0 24 24"><path d="M3 17l5-5 4 4 8-8M14 8h6v6"/></svg>'
  };

  let pendingRole = null;

  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  }
  function saveSession(s) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

  function enterRoleView(session) {
    if (!session || !session.role) return;
    if (session.role === "student") {
      const sel = document.getElementById("student-identity");
      if (sel) { sel.value = session.name; sel.disabled = true; }
      showScreen("student");
    } else {
      const nameEl = document.getElementById("advisor-name");
      const titleEl = document.getElementById("advisor-title");
      const avatarEl = document.getElementById("advisor-avatar");
      if (nameEl) nameEl.textContent = session.name;
      if (titleEl) titleEl.textContent = session.title || "Academic Advisor";
      if (avatarEl) {
        avatarEl.textContent = (session.name || "AD")
          .split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
      }
      try { renderRiskList(); } catch (e) {}
      try { renderLogTable(); } catch (e) {}
      showScreen("advisor");
    }
  }

  const roleChooser = document.getElementById("role-chooser");
  const loginPanel  = document.getElementById("login-panel");
  const loginForm   = document.getElementById("login-form");
  const loginUser   = document.getElementById("login-username");
  const loginPass   = document.getElementById("login-password");
  const loginError  = document.getElementById("login-error");
  const loginTitle  = document.getElementById("login-title");
  const loginSub    = document.getElementById("login-sub");
  const loginAvatar = document.getElementById("login-avatar");
  const loginDemo   = document.getElementById("login-demo");
  const pwToggle    = document.getElementById("pw-toggle");
  const loginBack   = document.getElementById("login-back");

  function showLogin(role) {
    pendingRole = role;
    loginTitle.textContent = role === "student" ? "Student sign in" : "Advisor sign in";
    loginSub.textContent = role === "student"
      ? "Sign in with your UGBS student credentials."
      : "Sign in with your departmental advisor credentials.";
    loginAvatar.innerHTML = AUTH_ICONS[role];
    loginDemo.innerHTML =
      `Demo credentials &mdash; username <code>${role === "student" ? "ama" : "zaydan"}</code> ` +
      `&middot; password <code>${role === "student" ? "ugbs2026" : "advisor2026"}</code>`;
    loginError.textContent = "";
    loginError.classList.remove("show");
    loginForm.reset();
    roleChooser.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    setTimeout(() => loginUser && loginUser.focus(), 50);
  }

  function showRoleChooser() {
    pendingRole = null;
    loginPanel.classList.add("hidden");
    roleChooser.classList.remove("hidden");
  }

  document.getElementById("enter-student").addEventListener("click", () => showLogin("student"));
  document.getElementById("enter-advisor").addEventListener("click", () => showLogin("advisor"));
  loginBack.addEventListener("click", showRoleChooser);

  pwToggle.addEventListener("click", () => {
    const show = loginPass.type === "password";
    loginPass.type = show ? "text" : "password";
    pwToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loginError.classList.remove("show");

    const u = (loginUser.value || "").trim().toLowerCase();
    const p = loginPass.value || "";
    if (!u || !p) {
      loginError.textContent = "Please enter both username and password.";
      loginError.classList.add("show");
      return;
    }

    const list = ACCOUNTS[pendingRole] || [];
    const account = list.find(a => a.username.toLowerCase() === u && a.password === p);
    if (!account) {
      loginError.textContent = "Incorrect username or password. Please try again.";
      loginError.classList.add("show");
      loginPass.select();
      return;
    }

    const session = {
      role: pendingRole,
      username: account.username,
      name: account.name,
      title: account.title || null,
      studentId: account.studentId || null,
      since: Date.now()
    };
    saveSession(session);
    enterRoleView(session);
  });

  document.querySelectorAll("[data-signout]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      clearSession();
      const sel = document.getElementById("student-identity");
      if (sel) sel.disabled = false;
      showRoleChooser();
      showScreen("landing");
    });
  });

    document.querySelectorAll("[data-switch-role]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      // Same behaviour as sign-out: clear session and return to the chooser.
      clearSession();
      const sel = document.getElementById("student-identity");
      if (sel) sel.disabled = false;
      showRoleChooser();
      showScreen("landing");
    });
  });

  /* =========================================================
     7. SCREEN SWITCHING
     ========================================================= */
  const screens = {
    landing: document.getElementById("landing-screen"),
    student: document.getElementById("student-screen"),
    advisor: document.getElementById("advisor-screen")
  };

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.add("hidden"));
    screens[name].classList.remove("hidden");
    window.scrollTo(0, 0);
  }

  /* =========================================================
     8. STUDENT SCREEN
     ========================================================= */
  const identitySelect = document.getElementById("student-identity");
  STUDENT_RECORDS.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = `${s.name} \u2014 ${s.student_id}`;
    identitySelect.appendChild(opt);
  });

  const QUICK_FILLS = [
    { label: "Normal: probation CGPA", icon: ICONS.check,
      question: "What CGPA do I need to stay off academic probation?" },
    { label: "Complex: prerequisite + retake", icon: ICONS.sparkle,
      question: "I already failed OMIS 204 once \u2014 can I still register for OMIS 308 next semester, and how many times am I allowed to retake OMIS 204?" },
    { label: "Student lookup", icon: ICONS.user,
      question: "Is student 10910006 on track to graduate?" },
    { label: "Failure case: outside policy", icon: ICONS.alert,
      question: "Can I get a refund if I lose my student ID card?" }
  ];

  const quickfillRow = document.getElementById("quickfill-row");
  QUICK_FILLS.forEach((q) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quickfill-btn";
    btn.innerHTML = `${q.icon}<span>${q.label}</span>`;
    btn.addEventListener("click", () => {
      chatInput.value = q.question;
      chatInput.focus();
    });
    quickfillRow.appendChild(btn);
  });

  const chatThread = document.getElementById("chat-thread");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");

  function addMessage(role, html, extraClass) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}`;
    wrap.innerHTML = `
      <span class="msg-avatar">${role === "user" ? ICONS.user : ICONS.bot}</span>
      <div class="msg-bubble${extraClass ? " " + extraClass : ""}">${html}</div>
    `;
    chatThread.appendChild(wrap);
    chatThread.scrollTop = chatThread.scrollHeight;
  }

  function greet() {
    addMessage("assistant",
      "Hello! I'm the departmental advising assistant. Ask me about courses, prerequisites, " +
      "credits, retakes, probation, deferment or electives \u2014 I'll answer strictly from UGBS " +
      "programme documents. You can also ask about a specific student by ID " +
      "(e.g. \"Is student 10910006 on track?\").");
  }
  greet();

  function renderBubble(text, sources, declined) {
    let html = escapeHTML(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    if (sources && sources.length) {
      html += `<div class="msg-source">${ICONS.doc} Source${sources.length > 1 ? "s" : ""}: ${sources.join(" &amp; ")}</div>`;
    }
    return html;
  }

  chatForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const question = chatInput.value.trim();
    if (!question) return;
    const studentName = identitySelect.value;

    addMessage("user", escapeHTML(question));

    const answer = answerQuestion(question);
    addMessage("assistant", renderBubble(answer.text, answer.sources, answer.declined),
               answer.declined ? "declined" : "");

    questionLog.unshift({
      studentName,
      question,
      status: answer.declined ? "declined" : "answered",
      sourceTitles: answer.sources
    });

    chatInput.value = "";
    renderRiskList();
    renderLogTable();
  });

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* =========================================================
     9. ADVISOR — risk list + log table
     The web risk list uses the *same* rule-based classifier
     as the Python tool, so both sides agree.
     ========================================================= */
  const questionLog = [];
  const riskListEl = document.getElementById("risk-list");
  const logBodyEl = document.getElementById("log-body");

  function computeRisk(student) {
    // Map the Python classifier output into the web prototype's scoring shape.
    const rec = STUDENT_RECORDS.find(r => r.name === student.name) || null;
    let tier = "low";
    let score = 0;
    const reasons = [];

    if (rec) {
      const { status, reasons: pyReasons } = classifyStudent(rec);
      reasons.push(...pyReasons);
      if (status === "at_risk") { tier = "high"; score = 60; }
      else if (status === "borderline") { tier = "watch"; score = 30; }
      else { tier = "low"; score = 5; }
    }

    // Small boost for repeat-fail asks in the question log
    const repeatCount = questionLog.filter(l =>
      l.studentName === student.name && /\b(fail|failed|retake|retaking)\b/i.test(l.question)
    ).length;
    if (repeatCount >= 2) {
      score += 10;
      reasons.push(`Asked ${repeatCount} questions this session about failing/retaking a course.`);
      if (tier === "low") tier = "watch";
    }

    return { score, tier, reasons };
  }

  function statusOf(student) {
    const rec = STUDENT_RECORDS.find(r => r.name === student.name);
    if (!rec) return "On Track";
    const { status } = classifyStudent(rec);
    return status === "at_risk" ? "Needs Review"
         : status === "borderline" ? "Watch"
         : "On Track";
  }
  function statusClass(s) {
    return s === "On Track" ? "on-track" : s === "Watch" ? "watch" : "review";
  }

  function renderRiskList() {
    if (!riskListEl) return;
    const ranked = STUDENT_RECORDS
      .map(rec => {
        const fakeStudent = { name: rec.name };
        return { rec, risk: computeRisk(fakeStudent) };
      })
      .sort((a, b) => b.risk.score - a.risk.score);

    riskListEl.innerHTML = "";
    ranked.forEach((entry, index) => {
      const { rec, risk } = entry;
      const item = document.createElement("div");
      item.className = "risk-item";

      const reasonsHTML = risk.reasons.length
        ? risk.reasons.map(r => `<li>${ICONS.alert}<span>${r}</span></li>`).join("")
        : `<li class="none">No active risk factors currently.</li>`;

      item.innerHTML = `
        <button class="risk-summary" type="button" aria-expanded="false">
          <span class="risk-rank">${index + 1}</span>
          <span class="risk-name-block">
            <span class="name">${rec.name}</span>
            <span class="meta">${rec.student_id} &middot; Year ${rec.year} &middot; CGPA ${rec.cumulative_gpa.toFixed(2)}</span>
          </span>
          <span class="risk-score-badge ${risk.tier === "high" ? "high" : risk.tier === "watch" ? "watch" : "low"}">Score ${risk.score}</span>
          <span class="risk-chevron">${ICONS.chevron}</span>
        </button>
        <div class="risk-detail">
          <p>Why this score</p>
          <ul class="risk-reasons">${reasonsHTML}</ul>
        </div>
      `;

      const summaryBtn = item.querySelector(".risk-summary");
      summaryBtn.addEventListener("click", () => {
        const isOpen = item.classList.toggle("open");
        summaryBtn.setAttribute("aria-expanded", String(isOpen));
      });

      riskListEl.appendChild(item);
    });
  }

  function renderLogTable() {
    if (!logBodyEl) return;
    if (questionLog.length === 0) {
      logBodyEl.innerHTML = `<tr class="log-empty"><td colspan="4">No questions asked yet this session.</td></tr>`;
      return;
    }
    logBodyEl.innerHTML = questionLog.map((entry) => {
      const statusHTML = entry.status === "answered"
        ? `<span class="status-chip answered">${ICONS.check} Answered from policy</span>`
        : `<span class="status-chip declined">${ICONS.cross} Declined</span>`;
      const sources = entry.sourceTitles.length ? entry.sourceTitles.join(" & ") : "\u2014";
      return `
        <tr>
          <td>${escapeHTML(entry.studentName)}</td>
          <td>${escapeHTML(entry.question)}</td>
          <td>${statusHTML}</td>
          <td class="log-sources">${escapeHTML(sources)}</td>
        </tr>
      `;
    }).join("");
  }

  /* =========================================================
     10. ADVISOR DASHBOARD
     ========================================================= */
  function renderStatCards() {
    const grid = document.getElementById("stat-grid");
    if (!grid) return;
    const total = STUDENT_RECORDS.length;
    const counts = { "On Track": 0, "Watch": 0, "Needs Review": 0 };
    STUDENT_RECORDS.forEach(s => {
      const st = statusOf({ name: s.name });
      counts[st] = (counts[st] || 0) + 1;
    });
    const pct = n => ((n / total) * 100).toFixed(1) + "%";
    const SCALE = 482 / total;

    const cards = [
      { label: "Total Students", value: 482, foot: `\u2191 6% <span class="stat-up">vs. last semester</span>`, cls: "", icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>' },
      { label: "On Track", value: Math.round(counts["On Track"] * SCALE), foot: `<span class="stat-dot green"></span>${pct(counts["On Track"])}`, cls: "green", icon: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/>' },
      { label: "Watch List", value: Math.round(counts["Watch"] * SCALE), foot: `<span class="stat-dot amber"></span>${pct(counts["Watch"])}`, cls: "amber", icon: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01"/>' },
      { label: "Needs Review", value: Math.round(counts["Needs Review"] * SCALE), foot: `<span class="stat-dot red"></span>${pct(counts["Needs Review"])}`, cls: "red", icon: '<path d="M12 8v5M12 16h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>' }
    ];

    grid.innerHTML = cards.map(c => `
      <article class="stat-card ${c.cls}">
        <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24">${c.icon}</svg></span>
        <span class="stat-label">${c.label}</span>
        <span class="stat-value">${c.value}</span>
        <span class="stat-foot">${c.foot}</span>
      </article>`).join("");
  }

  function barChart(host, data) {
    if (!host) return;
    const W = 320, H = 170, P = { t: 14, r: 8, b: 26, l: 30 };
    const max = Math.max(...data.map(d => d.value)) || 1;
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const bw = iw / data.length * 0.62;
    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="mini-chart">`;
    for (let i = 0; i <= 4; i++) {
      const y = P.t + (ih * i / 4);
      svg += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" stroke="#eef1f6" stroke-width="1"/>`;
      svg += `<text x="${P.l - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="#8c8577">${Math.round(max - (max * i / 4))}</text>`;
    }
    data.forEach((d, i) => {
      const x = P.l + (iw * i / data.length) + (iw / data.length - bw) / 2;
      const h = (d.value / max) * ih;
      const y = P.t + ih - h;
      svg += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="2" fill="#24365e"/>`;
      svg += `<text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#4a5578">${d.value}</text>`;
      svg += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="8" fill="#8c8577">${d.label}</text>`;
    });
    svg += `</svg>`;
    host.innerHTML = svg;
  }

  function donutChart(host, data) {
    if (!host) return;
    const W = 320, H = 180, cx = 110, cy = H / 2, r = 62, inner = 40;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let angle = -Math.PI / 2, paths = "";
    data.forEach(d => {
      const slice = (d.value / total) * Math.PI * 2;
      const a1 = angle, a2 = angle + slice;
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const xi2 = cx + inner * Math.cos(a2), yi2 = cy + inner * Math.sin(a2);
      const xi1 = cx + inner * Math.cos(a1), yi1 = cy + inner * Math.sin(a1);
      const large = slice > Math.PI ? 1 : 0;
      paths += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z" fill="${d.color}"/>`;
      angle = a2;
    });
    let legend = data.map((d, i) => `
      <g transform="translate(200 ${40 + i * 26})">
        <circle cx="5" cy="5" r="5" fill="${d.color}"/>
        <text x="18" y="9" font-size="10" fill="#131c33">${d.label}</text>
        <text x="115" y="9" font-size="10" fill="#6a7490">${((d.value / total) * 100).toFixed(1)}%</text>
      </g>`).join("");
    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="mini-chart">
        ${paths}
        <text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="20" font-family="Georgia,serif" fill="#131c33">${total}</text>
        <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="9" fill="#6a7490">Total Students</text>
        ${legend}
      </svg>`;
  }

  function lineChart(host, data) {
    if (!host) return;
    const W = 320, H = 170, P = { t: 16, r: 14, b: 26, l: 30 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const min = 2.0, max = 4.0;
    const pts = data.map((d, i) => ({
      x: P.l + (iw * i / (data.length - 1)),
      y: P.t + ih - ((d.value - min) / (max - min)) * ih,
      ...d
    }));
    const path = pts.map((p, i) => (i ? "L" : "M") + p.x + " " + p.y).join(" ");
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="mini-chart">`;
    for (let i = 0; i <= 4; i++) {
      const y = P.t + (ih * i / 4);
      const v = (max - (max - min) * i / 4).toFixed(1);
      svg += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" stroke="#eef1f6"/>`;
      svg += `<text x="${P.l - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="#8c8577">${v}</text>`;
    }
    svg += `<path d="${path}" fill="none" stroke="#24365e" stroke-width="2"/>`;
    pts.forEach(p => {
      svg += `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#fff" stroke="#24365e" stroke-width="2"/>`;
      svg += `<text x="${p.x}" y="${p.y - 9}" text-anchor="middle" font-size="9" fill="#4a5578">${p.value.toFixed(2)}</text>`;
      svg += `<text x="${p.x}" y="${H - 8}" text-anchor="middle" font-size="8" fill="#8c8577">${p.label}</text>`;
    });
    svg += `</svg>`;
    host.innerHTML = svg;
  }

  function gpaBuckets() {
    return [
      { label: "0.0\u20131.9", test: g => g < 2.0 },
      { label: "2.0\u20132.4", test: g => g >= 2.0 && g < 2.5 },
      { label: "2.5\u20132.9", test: g => g >= 2.5 && g < 3.0 },
      { label: "3.0\u20133.4", test: g => g >= 3.0 && g < 3.5 },
      { label: "3.5\u20134.0", test: g => g >= 3.5 }
    ];
  }

  function renderCharts() {
    barChart(document.getElementById("chart-gpa"), gpaBuckets().map(b => ({
      label: b.label,
      value: STUDENT_RECORDS.filter(s => b.test(s.cumulative_gpa)).length * 10
    })));

    const counts = { "On Track": 0, "Watch": 0, "Needs Review": 0 };
    STUDENT_RECORDS.forEach(s => {
      const st = statusOf({ name: s.name });
      counts[st] = (counts[st] || 0) + 1;
    });
    donutChart(document.getElementById("chart-status"), [
      { label: "On Track",     value: counts["On Track"],     color: "#2f6d4f" },
      { label: "Watch List",   value: counts["Watch"],        color: "#c8992c" },
      { label: "Needs Review", value: counts["Needs Review"], color: "#a23b3b" }
    ]);

    const years = [1, 2, 3, 4];
    lineChart(document.getElementById("chart-level"), years.map(y => {
      const set = STUDENT_RECORDS.filter(s => s.year === y);
      const avg = set.length ? set.reduce((a, s) => a + s.cumulative_gpa, 0) / set.length : 0;
      return { label: "Year " + y, value: avg || 2 + y / 4 };
    }));
  }

  function renderStudentTable() {
    const tbody = document.getElementById("student-list-body");
    if (!tbody) return;
    const q = (document.getElementById("student-search")?.value || "").toLowerCase().trim();
    const lv = document.getElementById("filter-level")?.value || "";
    const st = document.getElementById("filter-status")?.value || "";

    const rows = STUDENT_RECORDS.filter(s => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.student_id.includes(q);
      const matchL = !lv || ("Level " + (s.year * 100)) === lv || ("Level " + s.year) === lv;
      const status = statusOf({ name: s.name });
      const matchS = !st || status === st;
      return matchQ && matchL && matchS;
    });

    if (!rows.length) {
      tbody.innerHTML = `<tr class="log-empty"><td colspan="9">No students match the current filters.</td></tr>`;
    } else {
      tbody.innerHTML = rows.map((s, i) => {
        const stat = statusOf({ name: s.name });
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${s.name}</td>
            <td>${s.student_id}</td>
            <td>Year ${s.year}</td>
            <td>Level ${s.year * 100}</td>
            <td>${s.cumulative_gpa.toFixed(2)}</td>
            <td>${s.credits_completed} / ${s.credits_required_to_date}</td>
            <td><span class="chip ${statusClass(stat)}">${stat}</span></td>
            <td><button class="btn-view" type="button" data-student="${s.student_id}">View</button></td>
          </tr>`;
      }).join("");
    }
    const countEl = document.getElementById("table-count");
    if (countEl) countEl.textContent = `Showing ${rows.length} of ${STUDENT_RECORDS.length} students`;
  }

  function downloadCSV(filename, header, rows) {
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const header = ["Name", "Student ID", "Year", "GPA", "Credits Completed", "Credits Expected", "Status"];
    const rows = STUDENT_RECORDS.map(s => [
      s.name, s.student_id, s.year, s.cumulative_gpa.toFixed(2),
      s.credits_completed, s.credits_required_to_date, statusOf({ name: s.name })
    ]);
    downloadCSV("ugbs-advisees.csv", header, rows);
  }

  function exportRiskReport() {
    const header = ["Rank", "Name", "ID", "Year", "CGPA", "Score", "Tier", "Reasons"];
    const ranked = STUDENT_RECORDS
      .map(rec => ({ rec, risk: computeRisk({ name: rec.name }) }))
      .sort((a, b) => b.risk.score - a.risk.score);
    const rows = ranked.map((e, i) => [
      i + 1, e.rec.name, e.rec.student_id, e.rec.year, e.rec.cumulative_gpa.toFixed(2),
      e.risk.score, e.risk.tier, e.risk.reasons.join(" | ")
    ]);
    downloadCSV("ugbs-risk-report.csv", header, rows);
  }

  function exportSessionLog() {
    const header = ["Student", "Question", "Status", "Source(s)"];
    const rows = questionLog.length ? questionLog.map(e => [
      e.studentName, e.question, e.status, e.sourceTitles.join(" | ") || "\u2014"
    ]) : [["\u2014", "No questions this session", "\u2014", "\u2014"]];
    downloadCSV("ugbs-session-log.csv", header, rows);
  }

  function showDashPage(name) {
    document.querySelectorAll(".dash-page").forEach(p => p.classList.remove("active"));
    const page = document.querySelector(`.dash-page[data-page="${name}"]`);
    if (page) page.classList.add("active");
    document.querySelectorAll(".dash-nav-link").forEach(l => {
      l.classList.toggle("active", l.dataset.page === name);
    });
    document.querySelector(".dash-main")?.scrollTo({ top: 0 });
  }

  function renderKBGrid() {
    const host = document.getElementById("kb-grid");
    if (!host) return;
    host.innerHTML = KB_DOCS.map(d => `
      <article class="kb-card">
        <span class="kb-id">${d.source}</span>
        <h4>${d.source}</h4>
        <p>${d.text.slice(0, 200)}&hellip;</p>
      </article>`).join("");
  }

  function renderProgressStats() {
    const host = document.getElementById("progress-stats");
    if (!host) return;
    const totalCredits = STUDENT_RECORDS.reduce((a, s) => a + s.credits_required_to_date, 0);
    const earned = STUDENT_RECORDS.reduce((a, s) => a + s.credits_completed, 0);
    const onTrack = STUDENT_RECORDS.filter(s => statusOf({ name: s.name }) === "On Track").length;
    const nearGrad = STUDENT_RECORDS.filter(s => s.credits_completed / s.credits_required_to_date >= 0.9).length;

    const cards = [
      { label: "Credits earned", value: earned, cls: "green" },
      { label: "Credits remaining", value: totalCredits - earned, cls: "amber" },
      { label: "On-track students", value: onTrack, cls: "" },
      { label: "Near graduation", value: nearGrad, cls: "green" }
    ];
    host.innerHTML = cards.map(c => `
      <article class="stat-card ${c.cls}">
        <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24"><path d="M22 10 12 5 2 10l10 5 10-5Z"/></svg></span>
        <span class="stat-label">${c.label}</span>
        <span class="stat-value">${c.value}</span>
      </article>`).join("");
  }

  function renderProgressList() {
    const host = document.getElementById("progress-list");
    if (!host) return;
    host.innerHTML = STUDENT_RECORDS.map(s => {
      const pct = Math.round((s.credits_completed / s.credits_required_to_date) * 100);
      return `
        <div class="progress-row">
          <div class="p-name">${s.name}<small>Year ${s.year} &middot; ${s.advisor}</small></div>
          <div class="progress-bar"><i style="width:${pct}%"></i></div>
          <div class="p-pct">${s.credits_completed} / ${s.credits_required_to_date} &middot; ${pct}%</div>
        </div>`;
    }).join("");
  }

  function renderAnalytics() {
    const gpaHost = document.getElementById("analytics-gpa");
    if (!gpaHost) return;
    barChart(gpaHost, gpaBuckets().map(b => ({
      label: b.label,
      value: STUDENT_RECORDS.filter(s => b.test(s.cumulative_gpa)).length * 10
    })));

    const counts = { "On Track": 0, "Watch": 0, "Needs Review": 0 };
    STUDENT_RECORDS.forEach(s => {
      const st = statusOf({ name: s.name });
      counts[st] = (counts[st] || 0) + 1;
    });
    donutChart(document.getElementById("analytics-status"), [
      { label: "On Track",     value: counts["On Track"],     color: "#2f6d4f" },
      { label: "Watch List",   value: counts["Watch"],        color: "#c8992c" },
      { label: "Needs Review", value: counts["Needs Review"], color: "#a23b3b" }
    ]);

    lineChart(document.getElementById("analytics-level"), [1, 2, 3, 4].map(y => {
      const set = STUDENT_RECORDS.filter(s => s.year === y);
      const avg = set.length ? set.reduce((a, s) => a + s.cumulative_gpa, 0) / set.length : 0;
      return { label: "Year " + y, value: avg || 2 + y / 4 };
    }));

    const body = document.getElementById("analytics-prog-body");
    if (body) {
      body.innerHTML = [1, 2, 3, 4].map(y => {
        const set = STUDENT_RECORDS.filter(s => s.year === y);
        if (!set.length) return "";
        const avg = set.reduce((a, s) => a + s.cumulative_gpa, 0) / set.length;
        const counts = { "On Track": 0, "Watch": 0, "Needs Review": 0 };
        set.forEach(s => counts[statusOf({ name: s.name })]++);
        return `<tr>
          <td>Year ${y}</td>
          <td>${set.length}</td>
          <td>${avg.toFixed(2)}</td>
          <td>${counts["On Track"]}</td>
          <td>${counts["Watch"]}</td>
          <td>${counts["Needs Review"]}</td>
        </tr>`;
      }).join("");
    }
  }

  function renderCoursesPage() {
    const body = document.getElementById("courses-body");
    if (!body) return;
    body.innerHTML = [1, 2, 3, 4].map(y => {
      const set = STUDENT_RECORDS.filter(s => s.year === y);
      return `<tr>
        <td>Year ${y}</td>
        <td>L${y}00</td>
        <td>${set.length}</td>
        <td>32</td>
      </tr>`;
    }).join("");
  }

  function renderStudentsPage() {
    const body = document.getElementById("students-full-body");
    if (!body) return;
    const q = (document.getElementById("students-search")?.value || "").toLowerCase().trim();
    const lv = document.getElementById("students-level")?.value || "";

    const rows = STUDENT_RECORDS.filter(s => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.student_id.includes(q);
      const matchL = !lv || ("Level " + (s.year * 100)) === lv;
      return matchQ && matchL;
    });

    body.innerHTML = rows.length ? rows.map((s, i) => {
      const stat = statusOf({ name: s.name });
      return `<tr>
        <td>${i + 1}</td>
        <td>${s.name}</td>
        <td>${s.student_id}</td>
        <td>Year ${s.year}</td>
        <td>Level ${s.year * 100}</td>
        <td>${s.cumulative_gpa.toFixed(2)}</td>
        <td><span class="chip ${statusClass(stat)}">${stat}</span></td>
      </tr>`;
    }).join("") : `<tr class="log-empty"><td colspan="7">No students match the filters.</td></tr>`;
  }

  function renderReportsPage() {
    document.querySelectorAll(".report-card").forEach(card => {
      card.onclick = () => {
        const r = card.dataset.report;
        if (r === "session-log") exportSessionLog();
        if (r === "risk") exportRiskReport();
        if (r === "students") exportCSV();
      };
    });
  }

  function initSettings() {
    const map = {
      "set-compact": { apply: v => document.getElementById("advisor-screen").classList.toggle("compact-tables", v) },
      "set-name":    { apply: v => { const el = document.querySelector(".user-info strong"); if (el) el.textContent = v; } },
      "set-title":   { apply: v => { const el = document.querySelector(".user-info em"); if (el) el.textContent = v; } }
    };
    Object.entries(map).forEach(([id, def]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = el.type === "checkbox" ? "change" : "input";
      el.addEventListener(evt, () => def.apply(el.type === "checkbox" ? el.checked : el.value));
      def.apply(el.type === "checkbox" ? el.checked : el.value);
    });

    const expandRisk = document.getElementById("set-expand-risk");
    if (expandRisk) {
      expandRisk.addEventListener("change", () => {
        document.querySelectorAll(".risk-item").forEach(item => {
          item.classList.toggle("open", expandRisk.checked);
          item.querySelector(".risk-summary")?.setAttribute("aria-expanded", String(expandRisk.checked));
        });
      });
    }
  }

  function initPageChat() {
    const form = document.getElementById("page-chat-form");
    const input = document.getElementById("page-chat-input");
    const thread = document.getElementById("page-chat-thread");
    if (!form || !thread) return;

    const welcome = document.createElement("div");
    welcome.className = "msg assistant";
    welcome.innerHTML = `<span class="msg-avatar">${ICONS.bot}</span><div class="msg-bubble">Welcome to the AI Academic Advisor console. Ask any policy question, check a specific student by ID, or ask who needs attention — every answer comes from the programme documents or the rule-based progress tool.</div>`;
    thread.appendChild(welcome);

    function appendMsg(role, html, cls) {
      const wrap = document.createElement("div");
      wrap.className = "msg " + role;
      wrap.innerHTML = `<span class="msg-avatar">${role === "user" ? ICONS.user : ICONS.bot}</span><div class="msg-bubble ${cls || ""}">${html}</div>`;
      thread.appendChild(wrap);
      thread.scrollTop = thread.scrollHeight;
    }

    form.addEventListener("submit", e => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      appendMsg("user", escapeHTML(q));
      const a = answerQuestion(q);
      appendMsg("assistant", renderBubble(a.text, a.sources, a.declined), a.declined ? "declined" : "");
      questionLog.unshift({
        studentName: identitySelect.value || "Advisor console",
        question: q,
        status: a.declined ? "declined" : "answered",
        sourceTitles: a.sources
      });
      renderLogTable(); renderRiskList();
      input.value = "";
    });
  }

  function initRailChat() {
    const form = document.getElementById("rail-form");
    const input = document.getElementById("rail-input");
    const thread = document.getElementById("advisor-chat");
    if (!form || !input || !thread) return;

    function appendRail(role, text) {
      const div = document.createElement("div");
      div.className = "rail-msg " + role;
      div.innerHTML = role === "assistant"
        ? `<span class="rail-avatar"><svg class="icon" viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 14h.01M15 14h.01"/></svg></span><p>${escapeHTML(text)}</p>`
        : `<p>${escapeHTML(text)}</p>`;
      thread.appendChild(div);
      thread.scrollTop = thread.scrollHeight;
    }

    const send = (text) => {
      const q = (text || input.value).trim();
      if (!q) return;
      appendRail("user", q);
      const a = answerQuestion(q);
      appendRail("assistant", a.text);
      questionLog.unshift({
        studentName: identitySelect.value || "Advisor console",
        question: q,
        status: a.declined ? "declined" : "answered",
        sourceTitles: a.sources
      });
      renderLogTable();
      renderRiskList();
      input.value = "";
    };

    form.addEventListener("submit", (e) => { e.preventDefault(); send(); });
    document.querySelectorAll("#rail-suggestions button").forEach(b => {
      b.addEventListener("click", () => send(b.textContent));
    });
  }

  function initDashboard() {
    renderStatCards();
    renderCharts();
    renderStudentTable();
    renderKBGrid();
    renderProgressStats();
    renderProgressList();
    renderAnalytics();
    renderCoursesPage();
    renderStudentsPage();
    renderReportsPage();
    initSettings();
    initPageChat();

    const today = document.getElementById("dash-today");
    if (today) {
      today.textContent = new Date().toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "short", year: "numeric"
      });
    }

    ["student-search", "filter-level", "filter-status"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", renderStudentTable);
    });
    ["students-search", "students-level"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", renderStudentsPage);
    });

    document.getElementById("export-csv")?.addEventListener("click", exportCSV);
    document.getElementById("quick-export")?.addEventListener("click", exportCSV);
    document.getElementById("students-export")?.addEventListener("click", exportCSV);

    document.querySelectorAll(".dash-nav-link").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        showDashPage(link.dataset.page);
      });
    });

    document.querySelectorAll("[data-goto]").forEach(btn => {
      btn.addEventListener("click", () => showDashPage(btn.dataset.goto));
    });
  }

  /* ---------------------------------------------------------
     BOOT
     --------------------------------------------------------- */
  renderRiskList();
  renderLogTable();
  initDashboard();
  initRailChat();

  (function restoreSession() {
    const s = loadSession();
    if (s && s.role) enterRoleView(s);
  })();
})();