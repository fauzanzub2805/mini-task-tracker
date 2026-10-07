#!/usr/bin/env bash
# Demo backend Mini Task Tracker. Jalankan dari host: bash scripts/demo.sh
# Syarat: Sail jalan, database sudah di-seed (migrate:fresh --seed), butuh curl + jq.
BASE=${BASE:-http://localhost}
JAR=$(mktemp)
B=$'\033[1m'; G=$'\033[32m'; R=$'\033[31m'; N=$'\033[0m'

# Tiap "orang" punya cookie jar sendiri. XSRF-TOKEN dari cookie dikirim balik sebagai header.
call() { # call <user> <METHOD> <path> [json]
  local jar="$JAR.$1" m=$2 p=$3 d=${4:-}
  [ -f "$jar" ] || curl -s -c "$jar" -H 'Accept: application/json' "$BASE/" -o /dev/null
  local x; x=$(awk '$6=="XSRF-TOKEN"{print $7}' "$jar" | tail -1 | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
  curl -s -b "$jar" -c "$jar" -X "$m" "$BASE$p" -H 'Accept: application/json' -H 'Content-Type: application/json' \
    -H "X-XSRF-TOKEN: $x" ${d:+-d "$d"} -w '\n%{http_code}'
}
show() { # show <judul> <user> <METHOD> <path> [json] -> cetak status + ringkasan
  local t=$1; shift
  local out code body; out=$(call "$@"); code=${out##*$'\n'}; body=${out%$'\n'*}
  local c=$G; [ "${code:0:1}" != 2 ] && c=$R
  printf "%s▶ %s%s\n   %s %s  →  %s%s%s\n" "$B" "$t" "$N" "$2" "$3" "$c" "$code" "$N"
  [ -n "$body" ] && echo "$body" | jq -c "${JQ:-.}" 2>/dev/null | cut -c1-230 | sed 's/^/   /'
  LAST=$body
}
login() { JQ='.data|{name,roles}' show "Login sebagai $1" "$1" POST /auth/login "{\"email\":\"$2\",\"password\":\"password\"}"; }
reset_throttle() { docker exec mini-task-tracker-laravel.test-1 php artisan cache:clear >/dev/null 2>&1; } # pembatas login 5x/menit
hr() { reset_throttle; printf "\n%s━━━ %s ━━━%s\n" "$B" "$1" "$N"; }
SUF=$RANDOM

hr "1. Auth + undangan (hanya Admin)"
login admin admin@example.com
login staff dewi.staff@example.com
JQ='.message' show "Staff mencoba mengundang (harus 403)" staff POST /invitations '{"email":"x@example.com","role_id":1}'
STAFF_ROLE=$(docker exec mini-task-tracker-pgsql-1 psql -U sail -d laravel -Atc "select id from roles where name='staff'")
JQ='.data|{email,status,role:.role.name}' show "Admin mengundang email baru" admin POST /invitations "{\"email\":\"peserta$SUF@example.com\",\"role_id\":$STAFF_ROLE}"
TOKEN=$(docker exec mini-task-tracker-pgsql-1 psql -U sail -d laravel -Atc "select token from invitations where email='peserta$SUF@example.com'")
JQ='.' show "Validasi token (publik, tanpa login)" anon GET /invitations/$TOKEN
JQ='.data|{name,email,roles}' show "Registrasi dengan token (email diambil dari undangan)" anon POST /auth/register "{\"token\":\"$TOKEN\",\"name\":\"Peserta Baru\",\"password\":\"rahasia123\",\"email\":\"penyusup@example.com\"}"
JQ='.message' show "Token yang sama dipakai lagi (harus 422)" anon2 POST /auth/register "{\"token\":\"$TOKEN\",\"name\":\"Dobel\",\"password\":\"rahasia123\"}"

hr "2. RBAC dua lapis: project"
login budi budi.manager@example.com
JQ='.message' show "Staff membuat project (harus 403)" staff POST /projects '{"name":"Terlarang"}'
JQ='.data|{id,name,members_count}' show "Manager membuat project" budi POST /projects "{\"name\":\"Demo Mentor $SUF\",\"description\":\"Project untuk demo\"}"
PID=$(echo "$LAST" | jq .data.id)
JQ='[.data[]|{user:.user.name,role:.role.name}]' show "Pembuat otomatis jadi anggota manager" budi GET /projects/$PID/members
login citra citra.manager@example.com
JQ='.message' show "Manager lain (bukan anggota) membuka project (harus 403)" citra GET /projects/$PID
JQ='.data|length' show "Daftar project Citra: hanya miliknya (jumlah)" citra GET /projects
JQ='.data|length' show "Daftar project Admin: semua project (jumlah)" admin GET /projects

hr "3. Keanggotaan project"
DEWI=$(docker exec mini-task-tracker-pgsql-1 psql -U sail -d laravel -Atc "select id from users where email='dewi.staff@example.com'")
MGR_ROLE=$(docker exec mini-task-tracker-pgsql-1 psql -U sail -d laravel -Atc "select id from roles where name='manager'")
JQ='.data|{user:.user.name,role:.role.name}' show "Manager menambah Dewi sebagai staff" budi POST /projects/$PID/members "{\"user_id\":$DEWI,\"role_id\":$STAFF_ROLE}"
JQ='.message' show "Dewi (staff project) menambah anggota (harus 403)" staff POST /projects/$PID/members "{\"user_id\":$DEWI,\"role_id\":$STAFF_ROLE}"

hr "4. Task: default, assignee wajib anggota, filter & sort"
JQ='.data|{id,title,status,priority:.priority.name}' show "Staff membuat task tanpa prioritas → otomatis medium" staff POST /projects/$PID/tasks '{"title":"Siapkan laporan"}'
T1=$(echo "$LAST" | jq .data.id)
HIGH=$(docker exec mini-task-tracker-pgsql-1 psql -U sail -d laravel -Atc "select id from priorities where name='high'")
show "Task prioritas high" staff POST /projects/$PID/tasks "{\"title\":\"Perbaiki bug login\",\"priority_id\":$HIGH,\"due_date\":\"2026-12-01\",\"assignee_id\":$DEWI}" >/dev/null
JQ='.errors' show "Assignee bukan anggota project (harus 422)" staff POST /projects/$PID/tasks '{"title":"X","assignee_id":1}'
JQ='[.data[]|{title,priority:.priority.name}]' show "Sort prioritas menurun → high dulu (bukan abjad)" staff GET "/projects/$PID/tasks?sort=priority&order=desc"
JQ='[.data[].title]' show "Search ?q=bug" staff GET "/projects/$PID/tasks?q=bug"
JQ='.message' show "Staff menghapus task (harus 403, hanya manager)" staff DELETE /tasks/$T1

hr "5. Komentar + status"
show "Staff mengubah status task" staff PATCH /tasks/$T1 '{"status":"in_progress"}' >/dev/null
JQ='.data|{author:.author.name,body}' show "Staff berkomentar" staff POST /tasks/$T1/comments '{"body":"Sedang dikerjakan"}'
JQ='[.data[].body]' show "Komentar terlama → terbaru" staff GET /tasks/$T1/comments

hr "6. Activity feed (audit trail, hanya-tambah)"
JQ='[.data[]|"\(.user.name): \(.action) - \(.description)"]' show "Feed project (terbaru di atas, termasuk aktivitas task)" budi GET /projects/$PID/activities
JQ='[.data[]|.action]' show "Feed task saja" budi GET /tasks/$T1/activities
JQ='.message' show "Mencoba menghapus feed (harus 405)" budi DELETE /projects/$PID/activities
show "Manager menghapus task" budi DELETE /tasks/$T1 >/dev/null
JQ='[.data[0]|{action,task_id,description}]' show "Jejak hapus tetap ada, task_id jadi null" budi GET /projects/$PID/activities
rm -f "$JAR".*
