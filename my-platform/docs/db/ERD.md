# ERD — 테이블 관계

작성일: 2026-09-19  
관련: [테이블명세](테이블명세.md) · [플로우](../플로우.md)

---

## 도식

```mermaid
erDiagram
  customers ||--o{ sites : has
  customers ||--o| auth_users : auth_id
  staff ||--o| auth_users : auth_id
  templates ||--o{ sites : template_id
  inquiries ||--o| sites : "sites.inquiry_id"
  customers ||--o{ inquiries : requests
  customers ||--o{ subscriptions : pays
  sites ||--o| subscriptions : "site당 1"
  subscriptions ||--o{ billing_history : has
  customers ||--o{ one_time_payments : OTP
  sites ||--o{ one_time_payments : optional
  customers ||--o{ customer_payment_methods : cards
  sites ||--o{ support_tickets : 수정요청
  customers ||--o{ support_tickets : opens
  sites ||--o{ user_posts : board
  sites ||--o{ user_messages : contact

  sites {
    uuid site_id PK
    varchar site_code
    varchar status "FLOW_STEP SSOT"
    varchar build_type
    uuid inquiry_id FK
  }

  inquiries {
    uuid inquiry_id PK
    int dev_fee_total
    timestamp down_paid_at
    timestamp final_paid_at
  }

  subscriptions {
    uuid subscription_id PK
    int amount
    date next_billing_date
    timestamp cancelled_at
    timestamp cancels_at
  }
```

---

## 관계

| 부모 | 자식 | FK |
|------|------|-----|
| customers | sites | sites.customer_id |
| templates | sites | sites.template_id |
| inquiries | sites | sites.inquiry_id |
| customers | inquiries | inquiries.customer_id |
| sites | subscriptions | subscriptions.site_id (UNIQUE) |
| subscriptions | billing_history | billing_history.subscription_id |
| sites | user_posts / user_messages / support_tickets | site_id |

---

## 주체

- **customers** = 고객(사장님)
- **staff** = 직원(본사)
- **user_*** = 방문자(공개 사이트)
