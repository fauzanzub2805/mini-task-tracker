Table Invitations {
  id bigserial [primary key]
  email varchar(255) [unique]
  token varchar(64) [unique]
  invited_by_id bigint 
  status varchar(16)
  expires_at timestamptz
  accepted_at timestamptz [null]
  created_at timestamptz

}

Table users {
  id bigserial [primary key]
  invitation_id bigint [unique]
  name varchar(100)
  email varchar(255) [unique]
  password_hash varchar(255)
  created_at timestamptz
  updated_at timestamptz

}

Table tasks {
  id bigserial [primary key]
  title varchar(200) 
  description text [null]
  status varchar(16)  
  due_date date [null]
  assignee_id bigint [null]
  created_by_id bigint
  created_at timestamptz
  updated_at timestamptz

}

Table comments {
  id bigserial [primary key]
  task_id bigint
  author_id bigint
  body text
  created_at timestamptz
  updated_at timestamptz

}


Ref: Invitations.invited_by_id >? users.id

Ref: users.invitation_id - Invitations.id

Ref: tasks.assignee_id >? users.id

Ref: tasks.created_by_id >? users.id

Ref: comments.task_id >? tasks.id

Ref: comments.author_id >? users.id