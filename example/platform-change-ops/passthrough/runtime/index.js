#!/usr/bin/env node
import { readFileSync } from 'fs'
import { resolve } from 'path'

const policy = JSON.parse(readFileSync(resolve(process.cwd(), 'passthrough/runtime/policy/mutation-rules.json'), 'utf-8'))
const approval = JSON.parse(readFileSync(resolve(process.cwd(), 'passthrough/runtime/policy/approval-rules.json'), 'utf-8'))

process.stdout.write(JSON.stringify({
  name: 'changeops-local',
  policyVersion: policy.version,
  approvalMode: approval.defaultMode,
}) + '\n')
