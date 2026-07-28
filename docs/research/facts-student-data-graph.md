# FACTS SIS API: the student data graph

What student data the API exposes, and how to walk from a student to their classes, teachers, terms, grades, and family.

Companion to [facts-api-sync.md](facts-api-sync.md), which covers auth, the students+staff sync, and the `personStudentId` trap. This doc assumes those and does not repeat them.

Primary sources, in trust order:

1. `reference/facts/api-definitions.json` — Swagger 2.0 spec of the FACTS SIS API (host `api.factsmgt.com`, 369 paths, 1091 definitions). The source that owns the answer.
2. **Live read-only probes against the school's own FACTS tenant, 2026-07-28.** All `GET`. No writes were made. Sample student: `studentId=1203006` (`personStudentId=1568`, grade `08`, enrolled) — chosen as the first row of `GET /Students?Filters=school.status==Enrolled`.
3. `scripts/facts/facts-client.mjs` — working client (rate limiter, auth headers, pagination envelope).
4. Public web — FACTS API docs are behind a partner portal; nothing citable found.

**Evidence tiers.** Every claim below is tagged:

| Tag | Meaning |
|---|---|
| **[live]** | Observed in a real response on 2026-07-28 |
| **[spec]** | In the Swagger definition, not exercised against live data |
| **[infer]** | Reasoned from spec + live shape; not directly confirmed |

## TL;DR

| Finding | Consequence |
|---|---|
| **`GET /Classes/Students/{studentId}` is the schedule hop** — one request, no join **[live]** | Student → classes is a single call. But it returns *every class ever*: 121 rows for our sample. Filter `yearId` or you get 10 years of history. |
| **`GET /Scheduling/Roster?Filters=studentId==X` is the report card** **[live]** | One request returns per-class `grade1..grade6`, `finalGrade`, term GPAs/averages, per-term absences and tardies, `gradeLevel`, passing flags. This is the single richest student endpoint in the API. |
| **Sieve filters use the flat entity column, NOT the DTO's nested reference path** **[live]** | `Filters=studentId==X` works. `Filters=studentReference.studentId==X` returns **HTTP 500** with a .NET stack trace. The response shape and the filter grammar are different vocabularies. |
| **The `includes` query param appears to be a no-op** **[live]** | `?includes=parents,classes,family` on `/Students` changed nothing and raised no error. There is no expansion mechanism — every hop is its own request. |
| **`ReportCardsOutput.schoolTermReference.yearId` holds a *term number*, not a year** **[live]** | Values 1,2,3,4 alongside `schoolYearReference.yearId` = `"261"`. Two adjacent fields with the same property name meaning different things. |
| **`GET /SchoolTerms` 404s; use `GET /Schools/{schoolId}/SchoolTerms`** **[live]** | The spec advertises a collection route that doesn't exist. `/SchoolTerms/v2` also 404s — it routes into `/SchoolTerms/{schoolTermId}` with `"v2"` as the id. |
| **Teacher is `Class.staffId` → `GET /People/Staff/{staffId}`** **[live]** | Direct, no intermediate. `staffId` and `personId` share an id space (already established in [facts-api-sync.md](facts-api-sync.md)). |
| **`IncludeAssignmentGrades=true` returns every student's grades in the class** **[live]** | A portal that uses this expansion leaks classmates' scores. Use `/Assignment/Grades/classes/{classId}?Filters=studentId==X` instead, which *is* scoped. |
| **Grade status is an ASCII char code in one endpoint, a letter in another** **[live]** | `/Gradebooks/Grade` → `"status": 86`; `/Assignment/Grades` → `"status": "V"`. 86 is ASCII `V` = `Valid`. |

## The relationship graph

Every edge below is a **separate HTTP request**. There is no expansion mechanism (see [The `includes` param](#the-includes-param-is-a-no-op)).

```
                        GET /People/{personId}          personId == studentId
  PersonVM  <-------------------------------------------------  Student
  (name, email)                                                 studentId
                                                                    |
        +-----------------------------------------------------------+
        |                        |                    |             |
        | /Classes/Students/     | /Scheduling/       | /People/    | /People/
        |   {studentId}          |   Roster           |  Parent     |  Students
        |   ?Filters=yearId==N   |   ?Filters=        |  Student    |  Homeroom
        v                        |   studentId==X     |             |
   ClassVmOutV2                  v                    v             v
   classId, name, section   RosterOutput        parentID -->   classId +
   courseID -----> Course   grade1..6,          /People/       staffId
   staffId ------> Staff    finalGrade,          {parentID}
   yearId -------> SchoolYear  termNAvg/GPA,
   term1..6 (bool)          termNAbsent/Tardy
        |
        +--> /Gradebooks/GbkSummary?Filters=studentId==X   (per class per term average)
        +--> /Gradebooks/Assignments?Filters=classId==C     (assignment definitions)
        +--> /Assignment/Grades/classes/{C}?Filters=studentId==X  (assignment scores)
        +--> /People/StudentAttendance?Filters=studentId==X (per class per day)
        +--> /Academics/ReportCards?Filters=studentId==X    (per class per term)
        +--> /Academics/Transcript?Filters=studentId==X     (historical, per course)
```

### Hop table

Join key on each side, and whether it's one request or two.

| From | To | Endpoint | Join key | Requests |
|---|---|---|---|---|
| Student | Name / email | `GET /People?Filters=personId==X` | `Student.studentId` == `PersonVM.personId` | 1 (batchable, see [facts-api-sync.md](facts-api-sync.md)) |
| Student | Classes | `GET /Classes/Students/{studentId}` | path param | 1 **[live]** |
| Student | Classes (alt) | `GET /Academics/Enrollments?Filters=studentId==X` | `ClassEnrollmentVm.studentId` | 1 **[live]** |
| Class | Teacher | `GET /People/Staff/{staffId}` | `ClassVmOutV2.staffId` == `StaffVmOut.staffId` | 1 per teacher **[live]** |
| Class | Co-teacher / aide | same | `secondaryStaffId` (V2) / `instructor2Id` (V1); `aideId` | 1 each **[live]** |
| Class | Course | `GET /Courses?Filters=courseID==X` | `ClassVmOutV2.courseID` == `CoursesVmOut.courseID` | 1 (batchable) **[live]** |
| Class | School year | `GET /SchoolYears` | `ClassVmOutV2.yearId` == `SchoolYearModel.yearId` | 1 for all years **[live]** |
| Class | Terms it meets | *(none — read the booleans)* | `term1`..`term6` on the class | 0 **[live]** |
| School year | Terms | `GET /Schools/{schoolId}/SchoolTerms` | `SchoolTermsVmOut.yearID` | 1 for all terms **[live]** |
| Student | Report-card grid | `GET /Scheduling/Roster?Filters=studentId==X` | `RosterOutput.studentReference.studentId` | 1 **[live]** |
| Student | Term grades | `GET /Academics/ReportCards?Filters=studentId==X` | `ReportCardsOutput.studentId` | 1 **[live]** |
| Student | Gradebook averages | `GET /Gradebooks/GbkSummary?Filters=studentId==X` | flat `studentId` | 1 **[live]** |
| Student + class | Assignment scores | `GET /Assignment/Grades/classes/{classId}?Filters=studentId==X` | path + flat filter | 1 per class **[live]** |
| Class | Assignment definitions | `GET /Gradebooks/Assignments?Filters=classId==X` | flat `classId` | 1 per class **[live]** |
| Assignment grade | Assignment | *(join)* | `AssignmentGradesModel.sisAssignmentId` == `AssignmentsOutput.id` | 0 **[live]** |
| Student | Homeroom + its teacher | `GET /People/StudentsHomeroom?Filters=studentId==X` | flat `studentId` | 1 — returns `classReference` **and** `staffReference` together **[live]** |
| Student | Advisor / mentor | `GET /People/StudentAdvising?Filters=studentId==X` | flat `studentId` | 1 **[spec]** |
| Student | Parents | `GET /People/ParentStudent?Filters=studentID==X` | `ParentStudentVM.studentID` | 1 **[live]** |
| Parent | Their students | `GET /People/ParentStudent?Filters=parentID==X` | `ParentStudentVM.parentID` | 1 **[infer]** — reverse of a proven filter |
| Parent | Name / email | `GET /People?Filters=personId==X` | `parentID` == `personId` | 1 (batchable) |
| Student | Attendance (per class/day) | `GET /People/StudentAttendance?Filters=studentId==X` | flat `studentId` | 1 **[live]** |
| Student | Attendance (per day) | `GET /People/AttendanceDaySummary?Filters=studentId==X` | flat `studentId` | 1 **[live]** |
| Student | Transcript | `GET /Academics/Transcript?Filters=studentId==X` | flat `studentId` | 1 **[live]** |

Note the casing inconsistency: `/People/ParentStudent` filters on **`studentID`** (capital D) while almost everything else uses **`studentId`**. Both were confirmed live on their respective endpoints.

### Two ways to get a student's classes

`/Classes/Students/{studentId}` and `/Academics/Enrollments?Filters=studentId==X` returned **the same 121 rows in the same order** for our sample **[live]**. They differ in payload:

- `/Classes/Students/{studentId}` → the class itself: `name`, `section`, `courseID`, `staffId`, `yearId`, `term1..6`, `requiredRoom`.
- `/Academics/Enrollments` → the enrollment edge: `enrolled`, `enrolled1..enrolled6` (per-term enrollment), `gradeLevel` at time of enrollment.

**Use `/Classes/Students/{studentId}` for a schedule** — it carries the teacher and course ids you need next. Reach for `/Academics/Enrollments` only when you need to know *which terms* the student was actually enrolled for, as distinct from which terms the class *meets*.

## The student record

`GET /Students` returns `PagedResultOfStudentModelV1_3`; `GET /Students/{personStudentId}` returns `StudentModelV1_3` **[spec]**. Four versions exist as definitions (`StudentModel`, `V1_1`, `V1_2`, `V1_3`) but only `V1_3` is returned by any `GET`; `V1_1` is the response type for `PUT`/`PATCH` **[spec]**.

`StudentModelV1_3` = `StudentRequestV1_1` + its own fields **[spec]**:

| Field | Type | Notes |
|---|---|---|
| `studentId` | int *req* | **The join key to `/People.personId`.** |
| `personStudentId` | int *req* | **A different id space.** Path param for `/Students/{personStudentId}`. See the trap table. |
| `configSchoolId` | int *req* | Defaults from the `x-configSchoolId` header |
| `schoolCode` | string | e.g. `"TCS-CA"` **[live]** |
| `school` | `StudentSchoolModel` | `status`, `substatus`, `enrollDate`, `withdrawDate`, `withdrawReason`, `graduationDate`, `gradeLevel`, `nextStatus`, `nextSchoolCode`, `nextGradeLevel` |
| `locker` | array of `StudentLockerModel` | Returned inline: `[{"id":1,"name":"109"},{"id":2,"name":""}]` **[live]** |
| `classYear` | string | Graduating class |
| `advisorId` | string | Note: **string**, while `StudentAdvising` uses an `advisorReference` |
| `gender`, `birthdate` | string | `birthdate` is typed `string`, not `date-time` |
| `homeroom` | string | Homeroom *name*, not an id. For the id, use `/People/StudentsHomeroom`. |
| `busOrCarpool` | string | |
| `studentUDID` | string | "Gets or Sets SchoolID value" |
| `demographics` | `DemographicsModel` | Wraps `AddressVM` + `PersonVM` **[spec]** — not populated in our live `/Students` responses |

**Not on the student record:** name, email, phone. Those live on `PersonVM` — join via `studentId == personId`.

Live sample **[live]**:

```json
{"personStudentId":1568,"studentId":1203006,"configSchoolId":1,"schoolCode":"TCS-CA",
 "school":{"status":"Enrolled","substatus":"","enrollDate":"2016-05-26T00:00:00Z",
           "withdrawReason":"","gradeLevel":"08","nextStatus":"Graduate",
           "nextSchoolCode":"TCS-CA","nextGradeLevel":""},
 "locker":[{"id":1,"name":"109"},{"id":2,"name":""}]}
```

536 enrolled students at `Filters=school.status==Enrolled` on 2026-07-28 **[live]** (535 on 2026-07-27 per [facts-api-sync.md](facts-api-sync.md); the cohort moves).

## "Grade" is four different things

The single most confusing word in this API. Disambiguated:

| Meaning | Where it lives | Type |
|---|---|---|
| **Grade level** (8th grade) | `StudentModelV1_3.school.gradeLevel`, `ClassEnrollmentVm.gradeLevel`, `RosterOutput.gradeLevel` | string, zero-padded: `"08"`, `"K"` **[live]** |
| **Grade level config** (the entity) | `GET /Academics/GradeLevels` → `gradeLevelId`, `gradeLevelName`, `nextGradeLevelReference`, `capacity`, `attendanceMethod`, report-card template names | **[live]** |
| **Term/final mark** (an A-) | `RosterOutput.grade1..grade6`, `finalGrade`; `ReportCardsOutput.grade`; `TranscriptOutput.finalGrade` | string letter **[live]** |
| **Assignment score** | `/Gradebooks/Grade`, `/Assignment/Grades` → `receivedPoints`/`maxPoints`/`displayGrade` | numeric + string **[live]** |

Additionally there are **skill grades** (`/Gradebooks/SkillGrades` — `term1Grade..term6Grade` per skill per class, for standards-based elementary reporting **[spec]**) and **standard term grades** (`/Gradebooks/StandardTermGrade` **[spec]**).

### Where to actually read a student's grades

Four endpoints overlap. Ranked by usefulness for a portal:

**1. `GET /Scheduling/Roster?Filters=studentId==X` — the report-card grid. [live]**

One row per student×class, ~140 fields. Live sample (student 1203006, class 11109 "08 ALG"):

```json
{"enrolled":true,
 "studentReference":{"studentId":1203006}, "classReference":{"classId":11109},
 "grade1":"A","grade2":"B","grade3":"A","grade4":"A-","finalGrade":"A-",
 "term1GPA":4.0,"term1Avg":93.0,"term2GPA":3.0,"term2Avg":87.0,
 "term3GPA":4.0,"term3Avg":95.0,"term4GPA":4.0,"term4Avg":90.0,
 "finalGradeGPA":4.0,"finalGradeAvg":91.0,
 "term1Absent":0.0,"term1Tardy":0.0,
 "term1Passing":true,"finalPassing":true,"gradeLevel":"08",
 "schoolYearReference":{"yearId":"0"}}
```

Also carries: `citizen1..6` (citizenship marks), `com1..6` (term comments), `prG1..6`/`prC1..6` (progress-report grades and comments), `sem1..3` grades/GPAs/exams, `enrolled1..6`, `creditsOverride`, `term1UGPA..` (unweighted GPA), and `transcriptIDT1..6` linking each term to a transcript row.

⚠ **`schoolYearReference.yearId` came back `"0"` at this school [live]**, and `Filters=studentId==X,yearId==270` returned **zero rows** — the filter field is recognized but the underlying column is unpopulated. **You cannot scope Roster by year.** Scope it by `classId` instead, using the class list from `/Classes/Students/{studentId}?Filters=yearId==N`.

**2. `GET /Academics/ReportCards?Filters=studentId==X` — one row per class per term. [live]**

Carries `className`, `shortClassName`, `classSection`, **`instructor1Name`** (a *name string*, no staff id), `grade`, `comment`. Convenient because it denormalizes the teacher name, so you skip the `staffId` hop — at the cost of getting a display string you cannot join on.

**3. `GET /Gradebooks/GbkSummary?Filters=studentId==X` — computed averages per class per term. [live]**

```json
{"classReference":{"classId":7026},"studentReference":{"studentId":1203006},
 "classCategoryReference":{"classCategoryId":-1},
 "average":"80","letterGrade":"S","termReference":{"termId":1},
 "pointsEarned":80.0,"pointsPossible":100.0,"fullAverage":80.0,"decimalPlaces":0}
```

1,207 rows for our sample student across all years **[live]**. `classCategoryId: -1` appears to mean "all categories / the class overall" **[infer]** — the spec says this reference is the `AssessmentId` foreign key, and `-1` is not a real category id.

**4. `GET /Academics/Transcript?Filters=studentId==X` — the historical record. [live]**

One row per course per year, with `finalGrade`, `finalGradeGPA_real`, `credits_real`, `absent`, `tardy`, `term1Avg..term6Avg`, `courseLevel`, `department`, `passing`, `transfer`, and **`instructor`** as a `"Last, First"` string. Includes `yearName` (`"2023 - 2024 "` — note the trailing space **[live]**).

### Assignment-level detail

Two parallel APIs over the same data, with different field names and different `status` encodings:

| | `/Gradebooks/*` (newer) | `/Assignment*` (legacy) |
|---|---|---|
| Assignments | `GET /Gradebooks/Assignments?Filters=classId==X` → `id` | `GET /Assignments/classes/{classId}/terms/{termId}` → `sisAssignmentId` |
| Grades | `GET /Gradebooks/Grade?Filters=studentId==X` → `assignmentReference.gbkAssignmentId` | `GET /Assignment/Grades/classes/{classId}` → `sisAssignmentId` |
| Status | `86` (int, ASCII code) | `"V"` (string) |
| Student scoping | `Filters=studentId==X` **[live]** | `Filters=studentId==X` **[live]** |

`AssignmentGradesModel.sisAssignmentId` (264759) matched `AssignmentsOutput.id` (264759) for the same assignment **[live]** — so those two are one id space. Whether `gbkAssignmentId` is *also* that same space is **[unverified]**; the values we saw from `/Gradebooks/Grade` (114576) were from a different, older class than the ones we pulled from `/Gradebooks/Assignments`, so the comparison was never apples-to-apples.

`GbkGradeStatusEnum` **[spec]**: `65`=Absent, `68`=Dropped, `69`=Excused, `73`=Incomplete, `77`=Missing, `80`=Pending, `86`=Valid — i.e. ASCII `A`,`D`,`E`,`I`,`M`,`P`,`V`.

⚠ **Privacy:** `GET /Gradebooks/Assignments?Filters=classId==X&IncludeAssignmentGrades=true` returns an `assignmentGrades` array containing **every enrolled student's** `studentId` and score **[live]**. The other expansion flags (`IncludeCondensedGrades`, `IncludeStandards`, `IncludeStandardGrades`) are **[spec]**-documented and presumably behave the same. Do not use these in a student-facing path.

## Years, terms, and semesters

**School years** — `GET /SchoolYears` **[live]**, 29 rows:

```json
{"yearId":271,"yearName":"2026-2027","firstDay":"2026-08-11T00:00:00Z","lastDay":"2027-08-02T00:00:00Z","schoolCode":"TCS-CA"}
{"yearId":270,"yearName":"2025 - 2026","firstDay":"2025-08-11T00:00:00Z","lastDay":"2026-08-10T00:00:00Z"}
```

⚠ **`yearId` is not chronological.** The recent years happen to ascend (267→2022-23 … 271→2026-27), but `yearId` 249 is 1998-99 while 244 is 2004-05 **[live]**. **Select the current year by comparing today against `firstDay`/`lastDay`, never by `max(yearId)`.** Note also that `yearName` formatting is inconsistent (`"2026-2027"` vs `"2025 - 2026"`), so don't parse it.

**School terms** — `GET /Schools/{schoolId}/SchoolTerms` **[live]**, 106 rows (for `schoolId=1`):

```json
{"schoolTermID":11,"termID":1,"yearID":249,"name":"Q1","firstDay":"1998-08-01T00:00:00Z","lastDay":"1999-06-30T00:00:00Z","semesterID":1}
```

- `termID` — the **term slot**, 1–6. This is what `term1..term6` on a class and `grade1..grade6` on a roster row index into.
- `schoolTermID` — the globally unique term row. Renamed **`uniqueTermID`** in `/SchoolTerms/v2/Schools/{schoolId}` **[live]**; otherwise the two responses are identical.
- `semesterID` — `SemesterIDEnum` **[spec]**: `0`=Year, `1`=Sem1, `2`=Sem2, `3`=Sem3.

⚠ **Broken routes:** `GET /SchoolTerms` → **404** `{"statusCode":404,"message":"Resource not found"}` **[live]**, despite being in the spec. `GET /SchoolTerms/v2` → **400**, because ASP.NET routes it into `/SchoolTerms/{schoolTermId}` and fails to parse `"v2"` as an int **[live]**. Only the school-scoped forms work.

**Which term is "now"** must be computed from `firstDay`/`lastDay` — there is no `current`/`active` flag anywhere on the term or year models **[spec]**.

## Full inventory of student-scoped endpoints

All are `GET` with Sieve `Filters`/`Sorts`/`Page`/`PageSize` unless noted. **[spec]** unless marked **[live]**.

### Enrollment & status
| Endpoint | Returns |
|---|---|
| `/Students` **[live]** | `StudentModelV1_3` |
| `/Students/{personStudentId}` | single student |
| `/Students/{personStudentId}/School` | `StudentSchoolModel` (status, dates, grade level) |
| `/Students/Status`, `/Students/Status/{status}/Substatus` | the status/substatus vocabulary (no Sieve; plain array) |
| `/Students/EnrollmentHistories` | `studentId`, `yearId`, `gradeLevel`, `status`, `beginDate`, `endDate`, `note` |
| `/People/EnrollmentHistoryNew` | newer variant |
| `/Students/PreProgression`, `/Students/{personStudentId}/PreProgression` | next-year progression |
| `/Admissions/StudentReenroll/{studentId}`, `/Admissions/StudentApplications` | admissions/re-enrollment |

### Schedule & academics
| Endpoint | Returns |
|---|---|
| `/Classes/Students/{studentId}`, `/Classes/v2/Students/{studentId}` **[live]** | the student's classes |
| `/Academics/Enrollments` **[live]** | the enrollment edge, incl. `enrolled1..6` |
| `/Scheduling/Roster` **[live]** | the report-card grid (see above) |
| `/Scheduling/StudentRequests` | course requests for scheduling |
| `/Scheduling/ClassSchedule/yearId/{yearId}/classIds/{classIds}/startdate/{s}/enddate/{e}` | meeting times — the only *timetable* endpoint |
| `/Academics/ReportCards` **[live]** | per class per term marks |
| `/Academics/Transcript` **[live]**, `/Academics/TranscriptAbsent` | historical record |
| `/Academics/GradeLevels` **[live]** | grade-level configuration |
| `/Academics/CourseBooks`, `/Academics/Textbooks` | textbook assignments |

### Gradebook
`/Gradebooks/Grade` **[live]**, `/Gradebooks/GbkSummary` **[live]**, `/Gradebooks/Assignments` **[live]**, `/Gradebooks/SkillGrades`, `/Gradebooks/StandardTermGrade`, `/Gradebooks/StandardGroupTermGrade`, `/Gradebooks/StudentRank` (term rank, GPA, credits earned/attempted, honor roll), `/Gradebooks/ClassLetterGrades`, `/Gradebooks/GradingCodes`, `/Gradebooks/LMSGrades`, `/Gradebooks/CurriculumPlanStudent`, `/Gradebooks/ClassGroupStudents`, `/Gradebooks/PersonStandardizedTest` + `/Gradebooks/PersonStandardizedTestScore` (standardized tests, keyed by `personReference`), `/Gradebooks/WebTest`, `/Gradebooks/Syllabus`, `/Gradebooks/DiplomaGrades`.

Assignment-side: `/Assignments/classes/{classId}/terms/{termId}`, `/Assignment/Grades/classes/{classId}` **[live]**, `/Assignment/Categories/classes/{classId}`, `/Assignment/CodeTranslations/classes/{classId}`.

### Attendance
`/People/StudentAttendance` **[live]** (per class per day: `attendanceCode`, `attendanceDate`, `column`, `attendanceEventReason` — 1,718 rows for our sample), `/People/AttendanceDaySummary` **[live]** (per day: `absent`, `absentHalf`, `tardy` — 1,595 rows), `/Academics/AttendanceCodes`, `/People/AttendanceNotes`, `/People/AttendanceSeatingChart`, `/Gradebooks/AttendanceAbsenceConversionHistory`.

### Family & contacts
| Endpoint | Returns |
|---|---|
| `/People/ParentStudent` **[live]** | `parentID`, `studentID`, `relationship`, `custody`, `correspondence`, `reportCard`, `parentsWeb`, `pickUp`, `emergencyContact`, `grandparent`, `pwBlock`, `reEnroll` |
| `/People/ParentStudent/parent/{parentId}/student/{studentId}` | a single link |
| `/Families`, `/Families/{familyId}` | family records |
| `/People/PersonFamily` | person↔family membership |
| `/People/EmergencyContact` | emergency contacts |
| `/Students/PickupContacts` | `firstName`, `lastName`, `relationship`, phones, `email`, `portalSortOrder`, `refId` (→ `personId` when set) |
| `/People/FamilyNote`, `/People/DirectoryPreferences`, `/People/Address` | |

Live for student 1203006: 3 parent links — Father (`parentID` 1202094), Mother (1202095), and one more **[live]**.

### Health, conduct, and pastoral
`/Medical/General` (+ `/Persons/{personId}`), `/Medical/Header/PersonId/{personId}`, `/Medical/Allergies`, `/Medical/Conditions`, `/Medical/Immunizations`, `/Medical/Events`, `/Medical/MedicalNotes`, `/Medical/OTCMedications/{personId}`, `/Medical/PrescriptionMedications`, `/Medical/ScheduledMedications`, `/Medical/Screenings`, `/Medical/MedicalEventsReport`.

`/People/BehaviorEvents` — discipline: `dateOfIncident`, `violation`, `descriptionOfIncident`, `sanction1/2`, `demerits`, `level`, `status`, `reportedBy`, `reviewedBy`, `studentID`, `staffID`.

`/Students/AdvisingNotes`, `/People/StudentAdvising`, `/Students/Conference`, `/People/Notes`, `/People/PersonTracking`, `/People/TrackingData`.

### Recognition & extras
`/Students/Honors` (honor-roll *rules*, not awards: `calcMethod`, `minAvg`, `minCredits`, `sequence`), `/Students/Recognition` (actual awards, filterable by `studentId`+`yearId`), `/Students/ServiceHours`, `/Students/Alerts` + `/Students/AlertApplication`, `/Students/LockerConfiguration`, `/People/Interests`, `/People/StudentTransportation`, `/Academics/Transportation`, `/Cafeteria/LunchOrders`, `/Billing/AccountStudentTuitionPlan`, `/Billing/FamilyAccounting`.

### Custom fields
`/UserDefinedFields` (definitions) + `/UserDefinedData` (values) + `/UserDefinedGroups`. Not probed **[spec]**.

## ID-space traps

| Trap | Detail |
|---|---|
| **`personStudentId` ≠ `studentId`** | Already documented in [facts-api-sync.md](facts-api-sync.md). Both resolve against `/People`, to *different people*. `/Students/{personStudentId}` takes the former; **every relationship endpoint in this doc takes the latter**. Sample student: `personStudentId` 1568, `studentId` 1203006 — not remotely similar magnitudes, which is a useful smell test. |
| **`ReportCardsOutput.schoolTermReference.yearId` is a term number** **[live]** | Observed values 1,2,3,4 with the self-link `SchoolTerm?Filters=yearId==1`. Sitting next to `schoolYearReference.yearId` = `"261"`. The wrapper type `SchoolTermReference` genuinely declares its only property as `yearId` **[spec]** — it's a spec-level naming bug, not a serialization accident. |
| **`SchoolYearReference.yearId` is a `string`; `SchoolTermReference.yearId` is an `int`** **[spec]** | Confirmed live: `"261"` vs `1`. Don't write one generic reference-unwrapper for both. |
| **`RosterOutput.schoolYearReference.yearId` is `"0"`** **[live]** | Unpopulated at this school. Roster rows carry no usable year. Derive year via `classId` → `/Classes`. |
| **`instructor2Id` (V1) == `secondaryStaffId` (V2)** **[live]** | Same field, renamed across class versions. Both returned `1202753` for class 6575. If you mix `/Classes` and `/Classes/v2` you will silently lose the co-teacher. |
| **`schoolTermID` (v1) == `uniqueTermID` (v2)** **[live]** | Same rename pattern on terms. |
| **`termID` (1–6) vs `schoolTermID` (unique)** **[live]** | 106 term rows share only 6 distinct `termID` values. `GbkSummary.termReference.termId` and `TranscriptOutput.termReference.termId` are the **1–6 slot**, even though their self-links point at `/SchoolTerms/v2/{id}` as if they were unique ids. Following those links gives you the wrong term. |
| **`StaffReference.staffId` is described as "student ID"** **[spec]** | Copy-paste error in the spec's description text. The field is a staff id. |
| **`classId` vs `courseID`** | A course is the catalog entry (`Algebra`, `courseID` 642); a class is a section of it in a year (`08 ALG` section A, `classId` 11109, `yearId` 270) **[live]**. Multiple classes share a `courseID`. |
| **Grade `status`: `86` vs `"V"`** **[live]** | Same enum, two serializations, across two endpoint families. |
| **`studentID` vs `studentId` casing** **[live]** | `/People/ParentStudent` wants `studentID`; the rest want `studentId`. |
| **`/Classes/Students/{id}` is unbounded in time** **[live]** | 121 rows spanning ~10 school years for one 8th grader. Always filter `yearId`. |

## Query mechanics

**Sieve.** Every list endpoint takes `Filters`, `Sorts`, `Page`, `PageSize` **[spec]**, plus `api-version=1`.

- `Filters=field==value` — equality. `,` separates ANDed clauses: `Filters=studentId==1203006,classId==11109` **[live]**. `|` is OR within one clause: `Filters=personId==1|2|3` (proven in `scripts/facts/fetch-students.mjs`).
- `Sorts=-yearId` — leading `-` for descending **[live]**.
- **Filter on the flat entity column, not the response's nested path.** `Filters=studentReference.studentId==X` on `/Scheduling/Roster` returns **HTTP 500** with a `Sieve.Services.SieveProcessor` stack trace and `"studentReference.studentId not found."`; `Filters=studentId==X` returns 200 **[live]**. This is the single most important mechanic in this document — the JSON you receive and the grammar you filter with are different vocabularies, and getting it wrong yields a 500 rather than a helpful 400.
- An unrecognized-but-plausible field yields an **empty result set**, not an error (`yearId` on `/Scheduling/Roster` **[live]**). So *zero rows does not mean "no data"* — it can mean "column unpopulated".

**Pagination envelope** (`PagedResultOf*`, uniform across every list endpoint) **[live]**:

```json
{"results":[...],"currentPage":1,"pageCount":268,"pageSize":2,"rowCount":536,
 "nextPage":"https://api.factsmgt.com/Students?...&Page=2"}
```

`scripts/facts/facts-client.mjs` walks this with `PageSize=1000`. Note `nextPage` is `""` on the last page, not `null` **[live]**.

### The `includes` param is a no-op

`/Students`, `/Students/{personStudentId}`, and `/People/ParentStudent` declare an `includes` query parameter; its description is literally `"The includes."` **[spec]**. Nothing in the spec enumerates legal values.

Live test: `GET /Students?Filters=studentId==1203006&includes=parents,classes,family` returned **byte-identical output** to the same call without `includes`, and no error **[live]**.

**Conclusion: there is no expansion mechanism.** Unknown values are silently swallowed. Every relationship in this document costs its own request. This is the central constraint on portal design. (It remains conceivable that some undocumented magic string works — but with no enumeration in the spec and silent failure on wrong guesses, there is no way to discover one. Treat expansion as unavailable.)

**Rate limit:** ~100 requests / rolling 60s, empirical, enforced with `429` + `Retry-After` — see [facts-api-sync.md](facts-api-sync.md). This becomes a real constraint here in a way it never was for the students+staff sync (see below).

## What this unlocks, and what it costs

### One student's current schedule + teachers + grades

| # | Request | Yield |
|---|---|---|
| 1 | `GET /SchoolYears` | pick current `yearId` by date range → `270` |
| 2 | `GET /Classes/Students/{studentId}?Filters=yearId==270` | **19 classes** for our sample **[live]** — `classId`, `name`, `section`, `courseID`, `staffId`, `term1..6` |
| 3 | `GET /People/Staff?Filters=staffId==a\|b\|c...` | all distinct teachers in one batched call **[infer]** — the OR-batching pattern is proven on `/People`, and `/People/Staff` takes the same Sieve params |
| 4 | `GET /Scheduling/Roster?Filters=studentId==X` | every term grade, average, GPA, absence, tardy — all 19 classes at once |
| 5 | *(optional)* `GET /Courses?Filters=courseID==a\|b\|c...` | course titles + departments **[infer]**, same batching |

**≈5 requests for a complete student academic page.** Well inside one rate-limit window. The `Roster` endpoint is what makes this cheap: without it you'd need a per-class call.

Add `GET /People?Filters=personId==X` for the student's own name, and `GET /People/StudentsHomeroom?Filters=studentId==X` for homeroom (which hands you the classId *and* staffId in one row).

### Assignment-level detail (a gradebook view)

Costs **2 requests per class** — `/Gradebooks/Assignments?Filters=classId==C` for the definitions and `/Assignment/Grades/classes/{C}?Filters=studentId==X` for the scores, joined on `sisAssignmentId` == `id`. For 19 classes that's **38 requests**, which is a third of the minute budget for *one student*. Fetch on demand per class, never eagerly for a whole schedule.

`/Gradebooks/Grade?Filters=studentId==X` returns all of a student's assignment grades across all classes and all years in one paged call — cheaper in requests, but unbounded in history and it gives you `gbkAssignmentId` rather than the confirmed-joinable `sisAssignmentId`.

### Whole-school sync

The tempting shape is one unfiltered pull per entity rather than per-student fan-out. `/Scheduling/Roster`, `/Academics/Enrollments`, and `/Gradebooks/GbkSummary` are all unfiltered-listable, so a nightly sync is a handful of paged pulls, not 536 × N. **Volumes are the thing to watch:** 1,718 attendance rows and 1,207 GbkSummary rows for a *single* student across ~10 years. School-wide, unfiltered, that is on the order of 10⁶ rows — at `PageSize=1000` that's ~1,000 requests, i.e. **~10 minutes against the rate limit**. Scope any such sync by year.

⚠ **No `modifiedDate` on most of these models.** `ClassVmOutV2`, `RosterOutput`, `TranscriptOutput`, `BehaviorEventsVmOut` have one **[spec]**; `ClassEnrollmentVm` has one; `GbkSummaryOutput`, `AttendanceDaySummaryOutput`, `ReportCardsOutput`, and `AssignmentGradesModel` **do not** **[spec]**. Incremental sync is not uniformly available. And as established in [facts-api-sync.md](facts-api-sync.md), there are no webhooks anywhere in the spec.

## Unresolved

Things I could not settle, stated plainly rather than guessed:

1. **Meeting times / bell schedule.** `Class.pattern` is an int, and `/Scheduling/PatternGroup` + `/Scheduling/ScheduleTemplate` exist, but I did not work out how a pattern id becomes "period 3, MWF". `/Scheduling/ClassSchedule/yearId/{y}/classIds/{ids}/startdate/{s}/enddate/{e}` is the likeliest source **[spec]** — not probed (its four required path params made a safe read-only probe awkward to construct without guessing). **A portal that wants a timetable with times on it still has an open question here.**
2. **Is `gbkAssignmentId` the same id space as `sisAssignmentId`?** `sisAssignmentId` == `AssignmentsOutput.id` is confirmed **[live]**. `gbkAssignmentId` is unconfirmed — the samples didn't overlap. One targeted probe would settle it.
3. **`/Gradebooks/StudentRank`** — has `termRank`, `rankCount`, `termGPA`, `creditsEarned`, `honorReference` **[spec]**. Not probed; unknown whether this school populates it (given `RosterOutput.schoolYearReference` came back `"0"`, unpopulated columns are clearly a live risk here).
4. **Which `configSchoolId` / `schoolId` values are valid.** I used `1` throughout because `/Students` returns `configSchoolId: 1` **[live]**, and `/Schools/1/SchoolTerms` works. Whether the tenant has other schools is untested — `/SchoolConfigurations` would answer it.
5. **`DemographicsModel` on the student record.** Declared as `AddressVM` + `PersonVM` **[spec]**, which would collapse the `/People` join into the `/Students` call. It was **absent from every live `/Students` response** — possibly gated behind the `includes` param that appears not to work, possibly never populated. Worth one probe of `/Students/{personStudentId}` directly before designing around the join.
6. **Server-side `Filters` on `date` fields** (e.g. `attendanceDate>2026-01-01`) — Sieve supports comparison operators in general, untested here. Same open question flagged in [facts-api-sync.md](facts-api-sync.md) for `modifiedDate`.
