#!/usr/bin/env bash
#
# Create and authenticate test users in the dev Cognito pool, without needing a
# Google account per identity.
#
# Why this exists: the pool federates to Google only, so every test identity
# would otherwise cost a real, separate Google account. Gmail plus-aliases do
# not help — you+test@gmail.com is the same Google account, returns the same
# `sub`, and maps to a single Cognito user, so a permissions test run that way
# passes for the wrong reason.
#
# Why it is safe: this uses AdminInitiateAuth, an IAM-authorized API. It is not
# a public password login. Anyone who can run this already holds admin
# credentials for the AWS account. The hosted UI still offers only Google,
# because supported_identity_providers is unchanged. The ADMIN_USER_PASSWORD_AUTH
# flow exists on the dev app client only (see infra/cognito.tf).
#
# Usage:
#   scripts/dev-user.sh create <email>   # create if absent, then print tokens
#   scripts/dev-user.sh token  <email>   # same thing; re-runnable at any time
#   scripts/dev-user.sh list             # list test users in the pool
#   scripts/dev-user.sh delete <email>   # remove the Cognito user
#
# Emails default to the @example.com domain, which is reserved by RFC 2606 and
# can never be a real Google account. That matters: Cognito does not link a
# native user to a federated one sharing an address, so a test user on a real
# Gmail address would silently become a *second* user — exactly the confusion
# this script exists to remove.
#
# Requires: awscli v2, credentials for the travelbingo AWS account.

set -euo pipefail

ENV_NAME="${ENV_NAME:-dev}"
POOL_NAME="${POOL_NAME:-travelbingo-${ENV_NAME}}"
CLIENT_NAME="${CLIENT_NAME:-travelbingo-${ENV_NAME}-spa}"
DEFAULT_DOMAIN="${DEFAULT_DOMAIN:-example.com}"

die() {
  echo "error: $*" >&2
  exit 1
}

# Resolved from the AWS API rather than `terraform output`, because HCP owns the
# state and reading it would require `terraform login` first.
resolve_ids() {
  POOL_ID="${POOL_ID:-$(aws cognito-idp list-user-pools --max-results 60 \
    --query "UserPools[?Name=='${POOL_NAME}'].Id | [0]" --output text)}"

  if [[ -z "${POOL_ID}" || "${POOL_ID}" == "None" ]]; then
    die "no Cognito user pool named '${POOL_NAME}'. Has the ${ENV_NAME} infrastructure been applied?"
  fi

  CLIENT_ID="${CLIENT_ID:-$(aws cognito-idp list-user-pool-clients --user-pool-id "${POOL_ID}" --max-results 60 \
    --query "UserPoolClients[?ClientName=='${CLIENT_NAME}'].ClientId | [0]" --output text)}"

  if [[ -z "${CLIENT_ID}" || "${CLIENT_ID}" == "None" ]]; then
    die "no app client named '${CLIENT_NAME}' in pool ${POOL_ID}."
  fi
}

# Qualifies a bare name into an email, so `dev-user.sh token alice` works.
qualify() {
  local raw="$1"
  [[ "${raw}" == *@* ]] && echo "${raw}" || echo "${raw}@${DEFAULT_DOMAIN}"
}

# Cognito's default policy wants >=8 chars with upper, lower, digit, and symbol.
# The fixed suffix guarantees all four classes regardless of what random gives
# us; the character filter keeps the value safe to embed in JSON.
generate_password() {
  echo "$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)Aa1!"
}

ensure_user() {
  local email="$1"

  # A user that already exists is the normal case on re-run, not a failure.
  if aws cognito-idp admin-get-user \
    --user-pool-id "${POOL_ID}" --username "${email}" >/dev/null 2>&1; then
    return 0
  fi

  # SUPPRESS because there is no SES on this account, and Cognito's built-in
  # sender has a low daily cap that a bounced invite would burn through.
  aws cognito-idp admin-create-user \
    --user-pool-id "${POOL_ID}" \
    --username "${email}" \
    --user-attributes "Name=email,Value=${email}" "Name=email_verified,Value=true" \
    --message-action SUPPRESS \
    >/dev/null

  echo "created ${email}" >&2
}

# Sets a fresh password every time rather than storing or deriving one. This is
# also what moves a newly created user out of FORCE_CHANGE_PASSWORD.
authenticate() {
  local email="$1"
  local password
  password="$(generate_password)"

  aws cognito-idp admin-set-user-password \
    --user-pool-id "${POOL_ID}" \
    --username "${email}" \
    --password "${password}" \
    --permanent

  aws cognito-idp admin-initiate-auth \
    --user-pool-id "${POOL_ID}" \
    --client-id "${CLIENT_ID}" \
    --auth-flow ADMIN_USER_PASSWORD_AUTH \
    --auth-parameters "$(printf '{"USERNAME":"%s","PASSWORD":"%s"}' "${email}" "${password}")" \
    --query 'AuthenticationResult.[AccessToken,RefreshToken]' \
    --output text
}

cmd_token() {
  local email
  email="$(qualify "${1:?usage: dev-user.sh token <email>}")"

  resolve_ids
  ensure_user "${email}"

  local access refresh
  IFS=$'\t' read -r access refresh < <(authenticate "${email}")

  [[ -n "${access}" ]] || die "authentication returned no token"

  cat <<EOF

user: ${email}

# --- curl ---------------------------------------------------------------
export TOKEN='${access}'
curl -s -H "Authorization: Bearer \$TOKEN" https://dev.travelbingo.ca/api/cards

# --- browser ------------------------------------------------------------
# Paste into the devtools console on http://localhost:5173 or
# https://dev.travelbingo.ca, then reload. The app refreshes this into a live
# session on load, so no sign-in screen is involved.
localStorage.setItem('travelbingo.session', JSON.stringify({refreshToken:'${refresh}',email:'${email}'}))

EOF
}

cmd_list() {
  resolve_ids
  aws cognito-idp list-users --user-pool-id "${POOL_ID}" \
    --query 'Users[].{user:Username,status:UserStatus,created:UserCreateDate}' \
    --output table
}

cmd_delete() {
  local email
  email="$(qualify "${1:?usage: dev-user.sh delete <email>}")"

  resolve_ids
  aws cognito-idp admin-delete-user --user-pool-id "${POOL_ID}" --username "${email}"

  # `sub` is the DynamoDB partition key, so the account is gone but everything
  # it wrote is not. Say so rather than implying a clean removal.
  echo "deleted ${email} from Cognito."
  echo "note: their saved cards remain in the ${ENV_NAME} table, now unreachable." >&2
}

case "${1:-}" in
  create | token) shift; cmd_token "$@" ;;
  list)           cmd_list ;;
  delete)         shift; cmd_delete "$@" ;;
  *)
    sed -n '/^# Usage:/,/^#   scripts\/dev-user.sh delete/p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
