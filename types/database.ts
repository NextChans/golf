
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activity_notes": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"customer_id": string,"id": number,"subject_id": string | null,"subject_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"customer_id": string,"id"?: never,"subject_id"?: string | null,"subject_type": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"customer_id"?: string,"id"?: never,"subject_id"?: string | null,"subject_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_notes_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": string,"after": Json | null,"before": Json | null,"entity_id": string,"entity_type": string,"id": number,"ip": unknown,"occurred_at": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role": string,"after"?: Json | null,"before"?: Json | null,"entity_id": string,"entity_type": string,"id"?: never,"ip"?: unknown,"occurred_at"?: string,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: string,"after"?: Json | null,"before"?: Json | null,"entity_id"?: string,"entity_type"?: string,"id"?: never,"ip"?: unknown,"occurred_at"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"booking_events": {
                  Row: {
                    "created_at": string,"from_status": Database["public"]['Enums']["booking_status"] | null,"id": number,"message": string | null,"request_id": string,"to_status": Database["public"]['Enums']["booking_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_status"?: Database["public"]['Enums']["booking_status"] | null,"id"?: never,"message"?: string | null,"request_id": string,"to_status": Database["public"]['Enums']["booking_status"]
                  }
                  Update: {
                    "created_at"?: string,"from_status"?: Database["public"]['Enums']["booking_status"] | null,"id"?: never,"message"?: string | null,"request_id"?: string,"to_status"?: Database["public"]['Enums']["booking_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_events_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "booking_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_proposals": {
                  Row: {
                    "created_at": string,"created_by": string,"decided_at": string | null,"expires_at": string,"green_fee_per_person": number,"id": string,"memo": string | null,"request_id": string,"status": Database["public"]['Enums']["proposal_status"],"tee_time": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"decided_at"?: string | null,"expires_at": string,"green_fee_per_person": number,"id"?: string,"memo"?: string | null,"request_id": string,"status"?: Database["public"]['Enums']["proposal_status"],"tee_time": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"decided_at"?: string | null,"expires_at"?: string,"green_fee_per_person"?: number,"id"?: string,"memo"?: string | null,"request_id"?: string,"status"?: Database["public"]['Enums']["proposal_status"],"tee_time"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_proposals_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_proposals_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "booking_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_requests": {
                  Row: {
                    "assignee_id": string | null,"budget_per_person": number | null,"close_reason": string | null,"course_name_free": string | null,"created_at": string,"first_responded_at": string | null,"golf_course_id": string | null,"id": string,"note": string | null,"play_date": string,"players": number,"sla_breached_at": string | null,"sla_due_at": string,"status": Database["public"]['Enums']["booking_status"],"time_from": string | null,"time_pref": Database["public"]['Enums']["time_pref"],"time_to": string | null,"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"budget_per_person"?: number | null,"close_reason"?: string | null,"course_name_free"?: string | null,"created_at"?: string,"first_responded_at"?: string | null,"golf_course_id"?: string | null,"id"?: string,"note"?: string | null,"play_date": string,"players": number,"sla_breached_at"?: string | null,"sla_due_at": string,"status"?: Database["public"]['Enums']["booking_status"],"time_from"?: string | null,"time_pref": Database["public"]['Enums']["time_pref"],"time_to"?: string | null,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "assignee_id"?: string | null,"budget_per_person"?: number | null,"close_reason"?: string | null,"course_name_free"?: string | null,"created_at"?: string,"first_responded_at"?: string | null,"golf_course_id"?: string | null,"id"?: string,"note"?: string | null,"play_date"?: string,"players"?: number,"sla_breached_at"?: string | null,"sla_due_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"time_from"?: string | null,"time_pref"?: Database["public"]['Enums']["time_pref"],"time_to"?: string | null,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_requests_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_requests_golf_course_id_fkey"
      columns: ["golf_course_id"]
isOneToOne: false
      referencedRelation: "golf_courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"business_holidays": {
                  Row: {
                    "holiday": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "holiday": string,"name": string
                  }
                  Update: {
                    "holiday"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"deal_events": {
                  Row: {
                    "created_at": string,"deal_id": string,"from_status": Database["public"]['Enums']["deal_status"] | null,"id": number,"message": string | null,"to_status": Database["public"]['Enums']["deal_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deal_id": string,"from_status"?: Database["public"]['Enums']["deal_status"] | null,"id"?: never,"message"?: string | null,"to_status": Database["public"]['Enums']["deal_status"]
                  }
                  Update: {
                    "created_at"?: string,"deal_id"?: string,"from_status"?: Database["public"]['Enums']["deal_status"] | null,"id"?: never,"message"?: string | null,"to_status"?: Database["public"]['Enums']["deal_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "deal_events_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "membership_deals"
      referencedColumns: ["id"]
    }
                  ]
                },"golf_courses": {
                  Row: {
                    "address": string | null,"cancellation_policy": string | null,"contact_phone": string | null,"created_at": string,"id": string,"is_active": boolean,"name": string,"region": Database["public"]['Enums']["region"],"updated_at": string,"weekday_green_fee": number | null,"weekend_green_fee": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"cancellation_policy"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"region": Database["public"]['Enums']["region"],"updated_at"?: string,"weekday_green_fee"?: number | null,"weekend_green_fee"?: number | null
                  }
                  Update: {
                    "address"?: string | null,"cancellation_policy"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"region"?: Database["public"]['Enums']["region"],"updated_at"?: string,"weekday_green_fee"?: number | null,"weekend_green_fee"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"idempotency_keys": {
                  Row: {
                    "action": string,"created_at": string,"key": string,"request_hash": string,"result": Json | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"key": string,"request_hash": string,"result"?: Json | null,"user_id": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"key"?: string,"request_hash"?: string,"result"?: Json | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"membership_deals": {
                  Row: {
                    "agreed_price": number | null,"assignee_id": string | null,"close_reason": string | null,"contact_window": string | null,"contract_date": string | null,"created_at": string,"desired_price": number | null,"id": string,"listing_id": string | null,"note": string | null,"product_id": string | null,"side": Database["public"]['Enums']["deal_side"],"status": Database["public"]['Enums']["deal_status"],"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agreed_price"?: number | null,"assignee_id"?: string | null,"close_reason"?: string | null,"contact_window"?: string | null,"contract_date"?: string | null,"created_at"?: string,"desired_price"?: number | null,"id"?: string,"listing_id"?: string | null,"note"?: string | null,"product_id"?: string | null,"side": Database["public"]['Enums']["deal_side"],"status"?: Database["public"]['Enums']["deal_status"],"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "agreed_price"?: number | null,"assignee_id"?: string | null,"close_reason"?: string | null,"contact_window"?: string | null,"contract_date"?: string | null,"created_at"?: string,"desired_price"?: number | null,"id"?: string,"listing_id"?: string | null,"note"?: string | null,"product_id"?: string | null,"side"?: Database["public"]['Enums']["deal_side"],"status"?: Database["public"]['Enums']["deal_status"],"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_deals_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "membership_deals_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "membership_listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "membership_deals_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "membership_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "membership_deals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"membership_listings": {
                  Row: {
                    "asking_price": number,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"product_id": string,"status": Database["public"]['Enums']["listing_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asking_price": number,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"product_id": string,"status"?: Database["public"]['Enums']["listing_status"],"updated_at"?: string
                  }
                  Update: {
                    "asking_price"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"product_id"?: string,"status"?: Database["public"]['Enums']["listing_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_listings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "membership_listings_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "membership_products"
      referencedColumns: ["id"]
    }
                  ]
                },"membership_products": {
                  Row: {
                    "created_at": string,"golf_course_id": string,"id": string,"is_active": boolean,"kind": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"golf_course_id": string,"id"?: string,"is_active"?: boolean,"kind": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"golf_course_id"?: string,"id"?: string,"is_active"?: boolean,"kind"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_products_golf_course_id_fkey"
      columns: ["golf_course_id"]
isOneToOne: false
      referencedRelation: "golf_courses"
      referencedColumns: ["id"]
    }
                  ]
                },"membership_quotes": {
                  Row: {
                    "buy_price": number | null,"created_at": string,"created_by": string | null,"id": number,"product_id": string,"quoted_on": string,"sell_price": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "buy_price"?: number | null,"created_at"?: string,"created_by"?: string | null,"id"?: never,"product_id": string,"quoted_on": string,"sell_price"?: number | null
                  }
                  Update: {
                    "buy_price"?: number | null,"created_at"?: string,"created_by"?: string | null,"id"?: never,"product_id"?: string,"quoted_on"?: string,"sell_price"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_quotes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "membership_quotes_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "membership_products"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"channel": Database["public"]['Enums']["notify_channel"],"created_at": string,"dedupe_key": string,"event_type": string,"id": number,"last_error": string | null,"locked_at": string | null,"next_attempt_at": string,"payload": NonNullable<Json>,"provider_message_id": string | null,"recipient_kind": string,"recipient_user_id": string | null,"sent_at": string | null,"status": Database["public"]['Enums']["outbox_status"],"template_code": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel": Database["public"]['Enums']["notify_channel"],"created_at"?: string,"dedupe_key": string,"event_type": string,"id"?: never,"last_error"?: string | null,"locked_at"?: string | null,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"provider_message_id"?: string | null,"recipient_kind": string,"recipient_user_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["outbox_status"],"template_code": string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"channel"?: Database["public"]['Enums']["notify_channel"],"created_at"?: string,"dedupe_key"?: string,"event_type"?: string,"id"?: never,"last_error"?: string | null,"locked_at"?: string | null,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"provider_message_id"?: string | null,"recipient_kind"?: string,"recipient_user_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["outbox_status"],"template_code"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_recipient_user_id_fkey"
      columns: ["recipient_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"display_name": string | null,"id": string,"onboarded_at": string | null,"phone": string | null,"phone_verified_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"display_name"?: string | null,"id": string,"onboarded_at"?: string | null,"phone"?: string | null,"phone_verified_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"display_name"?: string | null,"id"?: string,"onboarded_at"?: string | null,"phone"?: string | null,"phone_verified_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"terms_agreements": {
                  Row: {
                    "agreed_at": string,"id": number,"terms_code": string,"user_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreed_at"?: string,"id"?: never,"terms_code": string,"user_id": string,"version": string
                  }
                  Update: {
                    "agreed_at"?: string,"id"?: never,"terms_code"?: string,"user_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "terms_agreements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"terms_versions": {
                  Row: {
                    "code": string,"effective_at": string,"required": boolean,"title": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"effective_at"?: string,"required": boolean,"title": string,"version": string
                  }
                  Update: {
                    "code"?: string,"effective_at"?: string,"required"?: boolean,"title"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "current_terms": {
                  Row: {
                    "code": string | null,"effective_at": string | null,"required": boolean | null,"title": string | null,"version": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_proposal":
{ Args: { "p_expected_version": number,"p_idempotency_key": string,"p_proposal_id": string }; Returns: {
              "assignee_id": string | null,
"budget_per_person": number | null,
"close_reason": string | null,
"course_name_free": string | null,
"created_at": string,
"first_responded_at": string | null,
"golf_course_id": string | null,
"id": string,
"note": string | null,
"play_date": string,
"players": number,
"sla_breached_at": string | null,
"sla_due_at": string,
"status": Database["public"]['Enums']["booking_status"],
"time_from": string | null,
"time_pref": Database["public"]['Enums']["time_pref"],
"time_to": string | null,
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "booking_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"advance_deal":
{ Args: { "p_deal_id": string,"p_expected_version": number,"p_to_status": Database["public"]['Enums']["deal_status"] }; Returns: {
              "agreed_price": number | null,
"assignee_id": string | null,
"close_reason": string | null,
"contact_window": string | null,
"contract_date": string | null,
"created_at": string,
"desired_price": number | null,
"id": string,
"listing_id": string | null,
"note": string | null,
"product_id": string | null,
"side": Database["public"]['Enums']["deal_side"],
"status": Database["public"]['Enums']["deal_status"],
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "membership_deals"
        isOneToOne: true
        isSetofReturn: false
      } },
"assign_booking":
{ Args: { "p_assignee_id": string,"p_expected_version": number,"p_request_id": string }; Returns: {
              "assignee_id": string | null,
"budget_per_person": number | null,
"close_reason": string | null,
"course_name_free": string | null,
"created_at": string,
"first_responded_at": string | null,
"golf_course_id": string | null,
"id": string,
"note": string | null,
"play_date": string,
"players": number,
"sla_breached_at": string | null,
"sla_due_at": string,
"status": Database["public"]['Enums']["booking_status"],
"time_from": string | null,
"time_pref": Database["public"]['Enums']["time_pref"],
"time_to": string | null,
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "booking_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"before_user_created_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"bootstrap_owner":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"cancel_booking":
{ Args: { "p_expected_version": number,"p_reason"?: string,"p_request_id": string }; Returns: {
              "assignee_id": string | null,
"budget_per_person": number | null,
"close_reason": string | null,
"course_name_free": string | null,
"created_at": string,
"first_responded_at": string | null,
"golf_course_id": string | null,
"id": string,
"note": string | null,
"play_date": string,
"players": number,
"sla_breached_at": string | null,
"sla_due_at": string,
"status": Database["public"]['Enums']["booking_status"],
"time_from": string | null,
"time_pref": Database["public"]['Enums']["time_pref"],
"time_to": string | null,
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "booking_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_deal":
{ Args: { "p_deal_id": string,"p_expected_version": number,"p_reason"?: string }; Returns: {
              "agreed_price": number | null,
"assignee_id": string | null,
"close_reason": string | null,
"contact_window": string | null,
"contract_date": string | null,
"created_at": string,
"desired_price": number | null,
"id": string,
"listing_id": string | null,
"note": string | null,
"product_id": string | null,
"side": Database["public"]['Enums']["deal_side"],
"status": Database["public"]['Enums']["deal_status"],
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "membership_deals"
        isOneToOne: true
        isSetofReturn: false
      } },
"complete_onboarding":
{ Args: { "p_agreed_codes": (string)[],"p_contact_phone"?: string,"p_display_name": string }; Returns: {
              "created_at": string,
"deleted_at": string | null,
"display_name": string | null,
"id": string,
"onboarded_at": string | null,
"phone": string | null,
"phone_verified_at": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_booking_request":
{ Args: { "p_budget_per_person": number,"p_course_name_free": string,"p_golf_course_id": string,"p_idempotency_key": string,"p_note": string,"p_play_date": string,"p_players": number,"p_time_from": string,"p_time_pref": Database["public"]['Enums']["time_pref"],"p_time_to": string }; Returns: {
              "assignee_id": string | null,
"budget_per_person": number | null,
"close_reason": string | null,
"course_name_free": string | null,
"created_at": string,
"first_responded_at": string | null,
"golf_course_id": string | null,
"id": string,
"note": string | null,
"play_date": string,
"players": number,
"sla_breached_at": string | null,
"sla_due_at": string,
"status": Database["public"]['Enums']["booking_status"],
"time_from": string | null,
"time_pref": Database["public"]['Enums']["time_pref"],
"time_to": string | null,
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "booking_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_deal_inquiry":
{ Args: { "p_contact_window": string,"p_desired_price": number,"p_idempotency_key": string,"p_listing_id": string,"p_note": string,"p_product_id": string,"p_side": Database["public"]['Enums']["deal_side"] }; Returns: {
              "agreed_price": number | null,
"assignee_id": string | null,
"close_reason": string | null,
"contact_window": string | null,
"contract_date": string | null,
"created_at": string,
"desired_price": number | null,
"id": string,
"listing_id": string | null,
"note": string | null,
"product_id": string | null,
"side": Database["public"]['Enums']["deal_side"],
"status": Database["public"]['Enums']["deal_status"],
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "membership_deals"
        isOneToOne: true
        isSetofReturn: false
      } },
"decline_proposal":
{ Args: { "p_expected_version": number,"p_proposal_id": string,"p_reason"?: string }; Returns: {
              "assignee_id": string | null,
"budget_per_person": number | null,
"close_reason": string | null,
"course_name_free": string | null,
"created_at": string,
"first_responded_at": string | null,
"golf_course_id": string | null,
"id": string,
"note": string | null,
"play_date": string,
"players": number,
"sla_breached_at": string | null,
"sla_due_at": string,
"status": Database["public"]['Enums']["booking_status"],
"time_from": string | null,
"time_pref": Database["public"]['Enums']["time_pref"],
"time_to": string | null,
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "booking_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"list_staff":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"email": string,"id": string,"last_sign_in_at": string,"mfa_enabled": boolean,"password_change_required": boolean,"role": string
            }[]
                           },
"propose_booking":
{ Args: { "p_expected_version": number,"p_green_fee_per_person": number,"p_memo"?: string,"p_request_id": string,"p_tee_time": string,"p_valid_minutes"?: number }; Returns: {
              "created_at": string,
"created_by": string,
"decided_at": string | null,
"expires_at": string,
"green_fee_per_person": number,
"id": string,
"memo": string | null,
"request_id": string,
"status": Database["public"]['Enums']["proposal_status"],
"tee_time": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "booking_proposals"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_auth_event":
{ Args: { "p_event": string }; Returns: undefined
                           },
"reject_booking":
{ Args: { "p_expected_version": number,"p_reason": string,"p_request_id": string }; Returns: {
              "assignee_id": string | null,
"budget_per_person": number | null,
"close_reason": string | null,
"course_name_free": string | null,
"created_at": string,
"first_responded_at": string | null,
"golf_course_id": string | null,
"id": string,
"note": string | null,
"play_date": string,
"players": number,
"sla_breached_at": string | null,
"sla_due_at": string,
"status": Database["public"]['Enums']["booking_status"],
"time_from": string | null,
"time_pref": Database["public"]['Enums']["time_pref"],
"time_to": string | null,
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "booking_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_app_setting":
{ Args: { "p_key": string,"p_value": Json }; Returns: undefined
                           },
"set_listing_visibility":
{ Args: { "p_listing_id": string,"p_visible": boolean }; Returns: {
              "asking_price": number,
"created_at": string,
"created_by": string | null,
"description": string | null,
"id": string,
"product_id": string,
"status": Database["public"]['Enums']["listing_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "membership_listings"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_staff_role":
{ Args: { "p_role": string,"p_user_id": string }; Returns: undefined
                           },
"start_deal":
{ Args: { "p_deal_id": string,"p_expected_version": number }; Returns: {
              "agreed_price": number | null,
"assignee_id": string | null,
"close_reason": string | null,
"contact_window": string | null,
"contract_date": string | null,
"created_at": string,
"desired_price": number | null,
"id": string,
"listing_id": string | null,
"note": string | null,
"product_id": string | null,
"side": Database["public"]['Enums']["deal_side"],
"status": Database["public"]['Enums']["deal_status"],
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "membership_deals"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_contact_phone":
{ Args: { "p_contact_phone": string }; Returns: {
              "created_at": string,
"deleted_at": string | null,
"display_name": string | null,
"id": string,
"onboarded_at": string | null,
"phone": string | null,
"phone_verified_at": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_deal_terms":
{ Args: { "p_agreed_price": number,"p_contract_date": string,"p_deal_id": string,"p_expected_version": number }; Returns: {
              "agreed_price": number | null,
"assignee_id": string | null,
"close_reason": string | null,
"contact_window": string | null,
"contract_date": string | null,
"created_at": string,
"desired_price": number | null,
"id": string,
"listing_id": string | null,
"note": string | null,
"product_id": string | null,
"side": Database["public"]['Enums']["deal_side"],
"status": Database["public"]['Enums']["deal_status"],
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "membership_deals"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "booking_status": "requested"|"in_review"|"proposed"|"confirmed"|"rejected"|"cancelled","deal_side": "buy"|"sell","deal_status": "inquiry"|"negotiating"|"contract_scheduled"|"contracted"|"transferring"|"completed"|"cancelled","listing_status": "listed"|"reserved"|"sold"|"hidden","notify_channel": "alimtalk"|"sms"|"slack"|"email","outbox_status": "pending"|"sending"|"sent"|"failed"|"dead","proposal_status": "offered"|"accepted"|"declined"|"expired"|"withdrawn","region": "seoul_gyeonggi"|"gangwon"|"chungcheong"|"jeolla"|"gyeongsang"|"jeju","time_pref": "part_1"|"part_2"|"range"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "booking_status": ["requested", "in_review", "proposed", "confirmed", "rejected", "cancelled"],"deal_side": ["buy", "sell"],"deal_status": ["inquiry", "negotiating", "contract_scheduled", "contracted", "transferring", "completed", "cancelled"],"listing_status": ["listed", "reserved", "sold", "hidden"],"notify_channel": ["alimtalk", "sms", "slack", "email"],"outbox_status": ["pending", "sending", "sent", "failed", "dead"],"proposal_status": ["offered", "accepted", "declined", "expired", "withdrawn"],"region": ["seoul_gyeonggi", "gangwon", "chungcheong", "jeolla", "gyeongsang", "jeju"],"time_pref": ["part_1", "part_2", "range"]
          }
        }
} as const
