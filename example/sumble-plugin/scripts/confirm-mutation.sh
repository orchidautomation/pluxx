#!/usr/bin/env bash
set -euo pipefail
# This hook runs before mutating MCP tools.
# The platform will prompt the user for confirmation.
# Mutating tools: ["CreateContactList","AddContactsToList","CreateOrganizationList","AddOrganizationsToList"]
echo "pluxx: This tool modifies data. The agent should confirm before proceeding." >&2
