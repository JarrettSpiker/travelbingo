#!/usr/bin/env bash
#
# Read the feedback submitted to a brand's site.
#
# Why this exists rather than a page in the application: a submission is text
# written by someone else. Rendering it in an authenticated admin view would
# create an injection surface and a moderation obligation; reading it in a
# terminal has neither — provided the terminal is not handed raw escape
# sequences, which is what `sanitize` below is for.
#
# Usage:
#   scripts/feedback.sh list [days]     # submissions from the last N days (default 14)
#   scripts/feedback.sh count [days]    # how many, without printing any of them
#
# The store is per brand AND per environment, because brand isolation IS stack
# isolation — office feedback lands in the office table and is not reachable
# from the travel one. Select with BRAND (default: travel) and ENV_NAME
# (default: dev), exactly as scripts/dev-user.sh does:
#
#   BRAND=office scripts/feedback.sh list
#   BRAND=office ENV_NAME=prod scripts/feedback.sh list 7
#
# Choosing explicitly is deliberate. There is no "all brands" mode: a report
# means something different depending on which site it came from, and merging
# the two would lose that.
#
# Submissions are keyed by the date they were made, so this queries one
# partition per day and never scans the table — the table also holds every card
# and trip, and a scan would read all of it to find a handful of items. The cost
# is one API call per day of window, which is why the default window is short.
#
# Submissions carry a TTL, so this also reports how many are close to expiring.
# Reading the tool once therefore tells you what is about to be lost, which is
# the failure mode a channel nobody checks actually has.
#
# Requires: awscli v2, python3, credentials for the travelbingo AWS account.

set -euo pipefail

BRAND="${BRAND:-travel}"
ENV_NAME="${ENV_NAME:-dev}"

# Keep this table in step with scripts/dev-user.sh, the `environments` map in
# infra/bootstrap/variables.tf, and each workspace's `bucket_name`. Every
# resource in a stack derives its name from the bucket name, the table included.
case "${BRAND}" in
  travel) STACK_NAME="travelbingo-${ENV_NAME}" ;;
  office) STACK_NAME="officelingobingo-${ENV_NAME}" ;;
  *)      echo "error: BRAND must be 'travel' or 'office' (got '${BRAND}')" >&2; exit 1 ;;
esac

case "${ENV_NAME}" in
  dev | prod) ;;
  *) echo "error: ENV_NAME must be 'dev' or 'prod' (got '${ENV_NAME}')" >&2; exit 1 ;;
esac

TABLE_NAME="${TABLE_NAME:-${STACK_NAME}}"

# Warn this many days before a submission's TTL removes it.
EXPIRY_WARNING_DAYS="${EXPIRY_WARNING_DAYS:-30}"

die() {
  echo "error: $*" >&2
  exit 1
}

# Neutralizes anything in submitted text that a terminal would interpret rather
# than print. This is the one place in the whole feature where attacker-supplied
# text meets something that acts on it — everything else either stores it or
# rejects it. Strips C0 and C1 control characters and DEL, keeping tab and
# newline, which are legitimate in a bug report.
sanitize() {
  LC_ALL=C tr -d '\000-\010\013\014\016-\037\177' | LC_ALL=C sed $'s/\xc2[\x80-\x9f]//g'
}

# The dates covering the last N days, so the query hits a bounded set of
# partitions. BSD date first, GNU date as the fallback.
date_partitions() {
  local days="$1" i=0
  while [[ "${i}" -lt "${days}" ]]; do
    date -u -v-"${i}"d +%Y-%m-%d 2>/dev/null || date -u -d "${i} days ago" +%Y-%m-%d
    i=$((i + 1))
  done
}

fetch() {
  local days="$1" partition
  for partition in $(date_partitions "${days}"); do
    aws dynamodb query \
      --table-name "${TABLE_NAME}" \
      --key-condition-expression 'PK = :pk' \
      --expression-attribute-values "{\":pk\":{\"S\":\"FEEDBACK#${partition}\"}}" \
      --output json \
      || die "query failed against ${TABLE_NAME}. Are your AWS credentials current?"
  done
}

# Parsed rather than pattern-matched: a message containing a brace or a quote
# would defeat anything less.
read -r -d '' RENDER <<'PYTHON' || true
import json, sys, time

warn_days, mode, brand, env, days = sys.argv[1:6]
warn_days = int(warn_days)

# The AWS CLI emits one JSON document per query. Concatenated, they have to be
# split before json.loads will take them.
items, buf, depth = [], "", 0
for ch in sys.stdin.read():
    buf += ch
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth == 0:
            items.extend(json.loads(buf).get("Items", []))
            buf = ""

def text(attr):
    return attr.get("S", "") if isinstance(attr, dict) else ""

rows = []
for item in items:
    context = item.get("context", {}).get("M", {})
    rows.append({
        "createdAt": text(item.get("createdAt")),
        "message": text(item.get("message")),
        "contact": text(item.get("contact")),
        "submitter": text(item.get("submitterId")),
        "expiresAt": int(item.get("expiresAt", {}).get("N") or 0),
        "context": {k: text(v) for k, v in context.items()},
    })

rows.sort(key=lambda r: r["createdAt"], reverse=True)

print()
print("{} submission(s) - {} {}, last {} day(s)".format(len(rows), brand, env, days))

soon = [r for r in rows if 0 < r["expiresAt"] - time.time() < warn_days * 86400]
if soon:
    print("{} of them expire within {} days and will be removed.".format(len(soon), warn_days))

if mode == "count" or not rows:
    print()
    sys.exit(0)

for row in rows:
    context = row["context"]
    print()
    print("-" * 72)

    header = [row["createdAt"]]
    if context.get("route"):
        header.append(context["route"])
    if context.get("viewport"):
        header.append(context["viewport"])
    print("  ".join(header))

    detail = [
        "build {}".format(context.get("buildSha", "")[:12] or "unknown"),
        "submitter {}".format(row["submitter"][:8] or "unknown"),
    ]
    if row["contact"]:
        detail.append("reply-to {}".format(row["contact"]))
    print("  ".join(detail))

    if context.get("userAgent"):
        print(context["userAgent"][:100])

    print()
    print(row["message"])

print()
PYTHON

render() {
  local days="$1" mode="$2"
  fetch "${days}" \
    | python3 -c "${RENDER}" "${EXPIRY_WARNING_DAYS}" "${mode}" "${BRAND}" "${ENV_NAME}" "${days}" \
    | sanitize
}

case "${1:-}" in
  list)  shift; render "${1:-14}" list ;;
  count) shift; render "${1:-14}" count ;;
  *)
    sed -n '/^# Usage:/,/^#   scripts\/feedback.sh count/p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
