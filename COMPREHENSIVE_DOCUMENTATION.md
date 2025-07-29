 # TaxOS Comprehensive Documentation

---

## Table of Contents
- [Database Structure](#database-structure)
- [API Endpoints](#api-endpoints)
- [React Components](#react-components)
- [Custom Hooks](#custom-hooks)
- [Contexts](#contexts)
- [Utility Functions](#utility-functions)

---

## Database Structure

### Tables

#### clients
| Column       | Type      | Description                                      |
|-------------|-----------|--------------------------------------------------|
| id          | uuid      | Primary key                                      |
| user_id     | uuid      | References auth.users(id), owner                 |
| name        | text      | Client name                                      |
| email       | text      | Client email                                     |
| phone       | text      | Client phone                                     |
| address     | text      | Client address                                   |
| tax_year    | integer   | Tax year (default: current year)                 |
| tax_id      | text      | Tax ID                                           |
| entity_type | text      | individual, llc, corporation, s_corp, partnership|
| status      | text      | active, inactive, archived                       |
| notes       | text      | Notes                                            |
| created_at  | timestamptz | Creation timestamp                              |
| updated_at  | timestamptz | Update timestamp                                |

#### documents
| Column           | Type      | Description                                    |
|------------------|-----------|------------------------------------------------|
| id               | uuid      | Primary key                                    |
| user_id          | uuid      | References auth.users(id)                      |
| client_id        | uuid      | References clients(id)                         |
| filename         | text      | Storage filename                               |
| original_filename| text      | Original filename                              |
| file_size        | bigint    | File size                                      |
| mime_type        | text      | MIME type                                      |
| document_type    | text      | w2, 1099, receipt, bank_statement, etc.        |
| storage_path     | text      | Storage path                                   |
| ocr_text         | text      | OCR extracted text                             |
| ai_summary       | text      | AI-generated summary                           |
| tags             | text[]    | Tags                                           |
| is_processed     | boolean   | Processed flag                                 |
| created_at       | timestamptz | Creation timestamp                            |
| updated_at       | timestamptz | Update timestamp                              |

#### vendors
| Column         | Type      | Description                                    |
|----------------|-----------|------------------------------------------------|
| id             | uuid      | Primary key                                    |
| user_id        | uuid      | References auth.users(id)                      |
| client_id      | uuid      | References clients(id)                         |
| name           | text      | Vendor name                                    |
| email          | text      | Vendor email                                   |
| phone          | text      | Vendor phone                                   |
| address        | text      | Vendor address                                 |
| tax_id         | text      | Vendor tax ID                                  |
| w9_status      | text      | missing, pending, completed, expired           |
| w9_document_id | uuid      | References documents(id)                       |
| total_paid     | numeric   | Total paid                                     |
| requires_1099  | boolean   | Needs 1099 form                                |
| last_contact_date | timestamptz | Last contact                                 |
| notes          | text      | Notes                                          |
| created_at     | timestamptz | Creation timestamp                            |
| updated_at     | timestamptz | Update timestamp                              |

#### irs_notices
| Column           | Type      | Description                                    |
|------------------|-----------|------------------------------------------------|
| id               | uuid      | Primary key                                    |
| user_id          | uuid      | References auth.users(id)                      |
| client_id        | uuid      | References clients(id)                         |
| document_id      | uuid      | References documents(id)                       |
| notice_type      | text      | Notice type                                    |
| notice_number    | text      | Notice number                                  |
| tax_year         | integer   | Tax year                                       |
| amount_owed      | numeric   | Amount owed                                    |
| deadline_date    | timestamptz | Deadline                                      |
| status           | text      | pending, in_progress, resolved, appealed       |
| priority         | text      | low, medium, high, critical                    |
| ai_summary       | text      | AI summary                                     |
| ai_recommendations| text     | AI recommendations                             |
| resolution_notes | text      | Resolution notes                               |
| created_at       | timestamptz | Creation timestamp                            |
| updated_at       | timestamptz | Update timestamp                              |

#### chat_messages
| Column           | Type      | Description                                    |
|------------------|-----------|------------------------------------------------|
| id               | uuid      | Primary key                                    |
| user_id          | uuid      | References auth.users(id)                      |
| client_id        | uuid      | References clients(id)                         |
| role             | text      | user, assistant                                |
| content          | text      | Message content                                |
| context_documents| uuid[]    | Related documents                              |
| ai_model         | text      | AI model used                                  |
| tokens_used      | integer   | Tokens used                                    |
| created_at       | timestamptz | Creation timestamp                            |

#### tasks
| Column           | Type      | Description                                    |
|------------------|-----------|------------------------------------------------|
| id               | uuid      | Primary key                                    |
| user_id          | uuid      | References auth.users(id)                      |
| client_id        | uuid      | References clients(id)                         |
| title            | text      | Task title                                     |
| description      | text      | Task description                               |
| task_type        | text      | general, deadline, follow_up, review, filing   |
| priority         | text      | low, medium, high                              |
| status           | text      | pending, in_progress, completed, cancelled     |
| due_date         | timestamptz | Due date                                      |
| completed_at     | timestamptz | Completion date                               |
| assigned_to      | uuid      | References auth.users(id)                      |
| created_at       | timestamptz | Creation timestamp                            |
| updated_at       | timestamptz | Update timestamp                              |

#### ai_insights
| Column           | Type      | Description                                    |
|------------------|-----------|------------------------------------------------|
| id               | uuid      | Primary key                                    |
| user_id          | uuid      | References auth.users(id)                      |
| client_id        | uuid      | References clients(id)                         |
| insight_type     | text      | deduction, compliance, optimization, etc.      |
| title            | text      | Insight title                                  |
| description      | text      | Insight description                            |
| confidence_score | numeric   | Confidence (0-1)                               |
| potential_savings| numeric   | Potential savings                              |
| status           | text      | new, reviewed, applied, dismissed              |
| source_documents | uuid[]    | Related documents                              |
| metadata         | jsonb     | Extra metadata                                 |
| created_at       | timestamptz | Creation timestamp                            |
| updated_at       | timestamptz | Update timestamp                              |

#### payment_transactions
| Column           | Type      | Description                                    |
|------------------|-----------|------------------------------------------------|
| id               | uuid      | Primary key                                    |
| user_id          | uuid      | References auth.users(id)                      |
| client_id        | uuid      | References clients(id)                         |
| vendor_id        | uuid      | References vendors(id)                         |
| amount           | numeric   | Payment amount                                 |
| payment_date     | date      | Payment date                                   |
| description      | text      | Description                                    |
| category         | text      | Category                                       |
| is_deductible    | boolean   | Is deductible                                  |
| document_id      | uuid      | References documents(id)                       |
| created_at       | timestamptz | Creation timestamp                            |
| updated_at       | timestamptz | Update timestamp                              |

### Relationships
- All tables reference `auth.users(id)` for ownership.
- `documents`, `vendors`, `irs_notices`, `tasks`, `ai_insights`, and `payment_transactions` reference `clients(id)`.
- `vendors` and `payment_transactions` reference `documents(id)` for W-9s and receipts.
- `payment_transactions` reference `vendors(id)`.

### Triggers & Functions
- `update_updated_at_column()`: Updates `updated_at` on row changes.
- `update_vendor_total()`: Updates vendor totals and 1099 status after payment changes.
- `generate_ai_insights()`: Inserts compliance insights for vendors requiring 1099s.

---

## API Endpoints

*To be filled: List and document all endpoints in supabase/functions (chat, extract-document-text, process-document-ai, etc.)*

---

## React Components

*To be filled: List and document all main components, their props, and usage examples.*

---

## Custom Hooks

*To be filled: List and document all custom hooks, their API, and usage.*

---

## Contexts

*To be filled: List and document all context providers and consumers, with usage.*

---

## Utility Functions

*To be filled: List and document all utility functions, their API, and usage.*
