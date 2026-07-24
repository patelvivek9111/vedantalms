# Partner field-mapping presets (sales / implementations)

**Status:** Phase 5  
**Audience:** Implementations, partner onboarding, Registrar SIS Config UI (“Apply preset”)

These presets mirror `DEFAULT_MAPPINGS` in:

- `services/sis/adapters/banner.js`
- `services/sis/adapters/peoplesoft.js`
- `services/sis/adapters/fedena.js`

API: `GET /api/registrar/sis/mapping-presets`  
UI: Registrar → SIS → Config → field mappings (`LMS←SIS`).

Canonical LMS fields are on the left; partner/SIS field names on the right.

---

## Grades.csv (outbound passback)

Always available as CSV fallback from Registrar → SIS → Export grades:

| LMS / CSV column | Meaning |
|------------------|---------|
| `sis_student_id` | Student SIS id |
| `sis_section_id` | Section CRN / class nbr |
| `email` | Student email |
| `final_grade` | Letter grade |
| `final_percent` | Numeric percent |
| `grade_points` | Points on scale |
| `status` | Snapshot lifecycle |
| `snapshot_hash` | Policy hash |

Live connectors POST the same rows (optionally remapped via `grades` mapping) when dry-run is off.

---

## Banner

### users
| LMS | Banner |
|-----|--------|
| sis_id | bannerId |
| email | emailAddress |
| first_name | firstName |
| last_name | lastName |
| student_id | spridenId |
| role | role |

### sections
| LMS | Banner |
|-----|--------|
| sis_section_id | crn |
| course_code | subjCourse |
| term_code | termCode |
| section | seqNumber |
| instructor_email | instructorEmail |
| max_enrollment | maxEnroll |
| title | courseTitle |

### enrollments
| LMS | Banner |
|-----|--------|
| sis_enrollment_id | enrollId |
| sis_section_id | crn |
| sis_student_id | bannerId |
| role | role |
| status | enrollStatus |

### grades
| LMS | Banner |
|-----|--------|
| sis_student_id | bannerId |
| sis_section_id | crn |
| final_grade | grade |
| final_percent | percent |

Env: `BANNER_SIS_URL`, `BANNER_SIS_TOKEN`, `BANNER_SIS_DRY_RUN`

---

## PeopleSoft

### users
| LMS | PeopleSoft |
|-----|------------|
| sis_id | emplid |
| email | email_addr |
| first_name | first_name |
| last_name | last_name |
| student_id | emplid |

### sections
| LMS | PeopleSoft |
|-----|------------|
| sis_section_id | class_nbr |
| course_code | catalog_nbr |
| term_code | strm |
| section | class_section |
| max_enrollment | enrl_cap |
| title | course_title_long |

### enrollments
| LMS | PeopleSoft |
|-----|------------|
| sis_section_id | class_nbr |
| sis_student_id | emplid |
| status | stdnt_enrl_status |

### grades
| LMS | PeopleSoft |
|-----|------------|
| sis_student_id | emplid |
| sis_section_id | class_nbr |
| final_grade | crse_grade_off |

Env: `PEOPLESOFT_SIS_URL`, `PEOPLESOFT_SIS_TOKEN`, `PEOPLESOFT_SIS_DRY_RUN`

---

## Fedena (India)

### users
| LMS | Fedena |
|-----|--------|
| sis_id | admission_no |
| email | email |
| first_name | first_name |
| last_name | last_name |
| program | batch_name |

### sections
| LMS | Fedena |
|-----|--------|
| sis_section_id | subject_id |
| course_code | code |
| term_code | academic_year |
| section | section_name |
| title | name |

### enrollments / grades
Use `admission_no` + `subject_id` (+ `grade` / `marks`).

Env: `FEDENA_SIS_URL`, `FEDENA_SIS_TOKEN`, `FEDENA_SIS_DRY_RUN`

---

## Custom REST

Identity mapping by default (`sis_id←sis_id`, …). Point `credentialsRef` or `CUSTOM_REST_SIS_URL` at a partner gateway that exposes `/users`, `/sections`, `/enrollments`, and accepts `POST …/grades`.

Live POST requires `CUSTOM_REST_SIS_DRY_RUN=false`.

---

## LTI AGS (not SIS mapping)

Grade passback to an LTI platform uses OAuth2 client credentials + AGS line items/scores — see `.env.example` `LTI_*` / `LTI_AGS_*`. Student identity prefers `ltiUserId` / `studentProfile.externalIds.lti`, then SIS id, then email.

---

## Board / UDISE packaging

India reports remain **export-only** unless `BOARD_SUBMIT_MODE=partner_webhook` and `BOARD_PARTNER_WEBHOOK_URL` are set. Partner receives HMAC-signed JSON (`X-Board-Signature: sha256=…`) containing the same extract rows as the CSV download.
