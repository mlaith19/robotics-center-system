-- Ensure admin role exists (key 'admin' for login roleKey)
INSERT INTO "Role" (id, key, name, description, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'admin', 'אדמין', 'מנהל מערכת', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE key = 'admin');

-- Ensure admin user exists (username/password: admin/admin)
INSERT INTO "User" (id, username, name, email, status, "roleId", permissions, "createdAt")
SELECT gen_random_uuid()::text, 'admin', 'אדמין', 'admin@example.com', 'active', r.id, '[]'::jsonb, NOW()
FROM "Role" r
WHERE r.key = 'admin' AND NOT EXISTS (SELECT 1 FROM "User" WHERE username = 'admin')
LIMIT 1;
