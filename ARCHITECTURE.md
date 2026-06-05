# ROBOTICS CENTER SaaS ARCHITECTURE

------------------------------------------------

SYSTEM TYPE

Multi-tenant SaaS

Tenant isolation strategy:
Tenant-per-Database

Each center has its own SQL database.

------------------------------------------------

HIGH LEVEL ARCHITECTURE

User Request

↓

Nginx (wildcard subdomains)

↓

Application Server

↓

Master Database (SaaS Control Plane)

↓

Tenant Database (per center)

------------------------------------------------

SUBDOMAIN FLOW

User opens:

center1.domain.com

Application extracts:

subdomain = center1

Lookup in master database:

domains table

Return:

center_id

Load center configuration.

------------------------------------------------

MASTER DATABASE

Stores SaaS configuration only.

Tables:

master_users  
centers  
domains  
plans  
plan_features  
subscriptions  
license_keys  
license_activations  
notification_logs  
subscription_change_history  
audit_logs  

------------------------------------------------

TENANT DATABASE

Each center database contains operational data.

Example tables:

users  
students  
teachers  
courses  
robotics programs  
reports  

No SaaS control data stored here.

------------------------------------------------

LICENSE FLOW

ACTIVE

↓

License expired

↓

EXPIRED_READONLY

(7 days grace period)

↓

ACTIVATION_ONLY

Only activation page allowed.

↓

Serial key activation

↓

ACTIVE

------------------------------------------------

TRIAL FLOW

TRIAL_ACTIVE

↓

TRIAL_EXPIRED_READONLY

↓

TRIAL_ACTIVATION_ONLY

------------------------------------------------

FEATURE GATING

Plans determine allowed features.

Backend enforcement:

requireFeature(featureKey)

Frontend hides disabled modules.

------------------------------------------------

CENTER PROVISIONING FLOW

Super Admin creates center.

System performs:

1 Create center record
2 Assign subdomain
3 Create tenant database
4 Run migrations
5 Create center admin user
6 Force password reset

------------------------------------------------

SCALABILITY

System designed for 500+ centers.

Techniques:

Connection pool TTL  
Master DB caching  
Tenant migration runner  
Per tenant backups  

------------------------------------------------

SECURITY PRINCIPLES

Tenant isolation at database level

Server-side access control

License keys hashed

Audit logs for all admin actions

Rate limiting login attempts