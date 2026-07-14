import {
  compileDistributionAdjunctInventory,
  computeDistributionAdjunctInventoryDigest,
  type DistributionAdjunctItem,
  type DistributionAdjunctSource,
} from '../src/distribution-adjuncts'

type Platform = DistributionAdjunctItem['sourcePlatform']
type Kind = DistributionAdjunctItem['kind']
type Owner = DistributionAdjunctItem['canonicalOwner']

function row(
  id: string,
  kind: Kind,
  path: string,
  sourcePlatform: Platform,
  canonicalOwner: Owner,
  digest: string,
  executable = false,
): DistributionAdjunctItem {
  return {
    id, kind, source: path, target: path, sourcePlatform, canonicalOwner, digest, executable,
    availability: 'source-inspected', requiredForPublication: false,
  }
}

function fixture(
  name: string,
  version: string,
  revision: string,
  items: DistributionAdjunctItem[],
): DistributionAdjunctSource {
  const digest = computeDistributionAdjunctInventoryDigest(items)
  return compileDistributionAdjunctInventory({
    provenance: { fixture: name, plugin: name, version, revision, digest, evidenceTier: 'fixture-source-inspection' },
    items,
  })
}

export const compoundEngineeringAdjunctFixture = fixture('compound-engineering', '3.19.0', 'f871e4b4308f5a175b38ccada51d80dd67bab4fc', [
  row('root-package', 'identity-manifest', 'package.json', 'opencode', 'distribution', 'e415198d289a3ed3faa8d2f6e8040d3d24a3c7686683811ecca4584d9e104549'),
  row('claude-manifest', 'identity-manifest', '.claude-plugin/plugin.json', 'claude-code', 'distribution', 'ab59bca7988c346d556644a38ce24bda6caa9cb912226812d279d4f004e3a022'),
  row('cursor-manifest', 'identity-manifest', '.cursor-plugin/plugin.json', 'cursor', 'distribution', 'a913a025839588946b4b5cc52aead80a47e81aca8d584c2cff6df6c0a7b2f459'),
  row('codex-manifest', 'identity-manifest', '.codex-plugin/plugin.json', 'codex', 'distribution', 'a63efb33b7834bca086922516af2a1a71cf4b45b847d47fa5874e2d7461105d6'),
  row('claude-marketplace', 'registration-catalog', '.claude-plugin/marketplace.json', 'claude-code', 'distribution', '057e14e8a58ce93c8ec9dae2bc1d5fa1036cc74f463af67a67ca2a85c5f11eb0'),
  row('cursor-marketplace', 'registration-catalog', '.cursor-plugin/marketplace.json', 'cursor', 'distribution', 'f2e7e93d72f586b5472ccd40c6466d31b765a19debd187e39108a3afdf7a2eb0'),
  row('codex-marketplace', 'registration-catalog', '.agents/plugins/marketplace.json', 'codex', 'distribution', '78a5b4d7f8e8c410f2c17317744dbb2c7023fc77e6d76b0c6f5448911033c119'),
  row('codex-icon', 'helper-payload', 'assets/icon.svg', 'codex', 'distribution', 'a15d14dc522dcbb52f6f04ce9738f2d0ff7f8e06cce9b17916013a4e8e602df2'),
  row('codex-logo', 'helper-payload', 'assets/logo.png', 'codex', 'distribution', '134613352009479aa461399349960147e9c10531f5302ad541e2263bd200bf75'),
  row('opencode-loader', 'lifecycle-entrypoint', '.opencode/plugins/compound-engineering.js', 'opencode', 'runtime', '4e263f7c7231791577ad3211d6f026693dc15fad24c01c886f0a74d5e5d5fc99'),
  row('legacy-install-policy', 'source-only-evidence', 'src/commands/install.ts', 'source-only', 'distribution', '1dea899e9064fa26312a6973f8646969c76720089a3647adcaf1d5b29047210d'),
  row('legacy-cleanup-policy', 'source-only-evidence', 'src/commands/cleanup.ts', 'source-only', 'distribution', 'b8e89a7cf6efa4d6444f0358cf0e62a510f7073f407354cd87c824d699504deb'),
])

export const hyperframesAdjunctFixture = fixture('hyperframes', '0.7.57', '6933e8acda57268da9a40e0adf3d99c85059d2b5', [
  row('claude-manifest', 'identity-manifest', '.claude-plugin/plugin.json', 'claude-code', 'distribution', 'd6150bb9bea10ee3e7c8a02c1dac50011102b00da30dde551dcda8c1c41cc250'),
  row('claude-marketplace', 'registration-catalog', '.claude-plugin/marketplace.json', 'claude-code', 'distribution', 'c98a8c6b5b9de250deba50f7812b21f030dccfe0d3a4f8f1fa38c3476d3bb6b9'),
  row('cursor-manifest', 'identity-manifest', '.cursor-plugin/plugin.json', 'cursor', 'distribution', 'd2ab61a6c97a1fd41c34c03bde32fb307a5d2e7c326163400f25203a93b24aad'),
  row('codex-manifest', 'identity-manifest', '.codex-plugin/plugin.json', 'codex', 'distribution', '20de2fddaf1c53c5486f7d4882ec30c8596c3e5ebe05ded1e08ab1a32695509f'),
  row('claude-hook-binding', 'lifecycle-entrypoint', '.claude/settings.json', 'claude-code', 'hooks', '643cbae45bf94c95e2e53e81a53d07e7055e4302db43898c2181da19ce8343eb'),
  row('codex-hook-binding', 'lifecycle-entrypoint', '.codex/hooks.json', 'codex', 'hooks', 'e1fd9764d34759a87c41dbfe969cd635188e3b6935b749f545e400d1449db750'),
  row('codex-icon', 'helper-payload', 'assets/icon.png', 'codex', 'distribution', 'cc97812c2f8b56feb96854141c609cdda17d64502d01da7ad7c0e5649bf8472e'),
  row('shared-logo', 'helper-payload', 'assets/logo.png', 'shared', 'distribution', '0328eb84e11871561739d8541bc30d4bdca81ceae09730be779e5c38ee8b7c60'),
  row('motion-builder', 'host-native-extension', 'skills/motion-graphics/agents/builder.md', 'shared', 'agents', 'e1456350ce7d066cfd3a86022aeba708129b0b9af722b03b40ed70eaf120f798'),
  row('motion-director', 'host-native-extension', 'skills/motion-graphics/agents/director.md', 'shared', 'agents', '58d418b1a1f2082274e6450d0741ebfb0b8037b4e2ece4b71742ab77e344b284'),
  row('motion-finalize', 'host-native-extension', 'skills/motion-graphics/agents/finalize.md', 'shared', 'agents', '695049164587f97d4326cc0a54f91d9667372a8de18bd55476b14d698862c0b7'),
  row('codex-skill-ui', 'host-native-extension', 'skills/hyperframes-keyframes/agents/openai.yaml', 'codex', 'distribution', '1fbce5f9defa4c5f2d9e8cd7fad67566e21aba09e93a25e5836ebca62bd68f4b'),
  row('skills-manifest', 'registration-catalog', 'skills-manifest.json', 'shared', 'distribution', 'fffffc165e1b7af3fbf8f324c71b0b14d095482925c2a45c924e8bddb61d8879'),
  row('agent-destination-topology', 'source-only-evidence', 'packages/cli/src/utils/agentDirs.generated.ts', 'source-only', 'distribution', '33b6f1c1de80f6525048c61ff528784fb304a8833ddabdac78b3794e562c124f'),
  row('skills-mirror-policy', 'source-only-evidence', 'packages/cli/src/utils/skillsMirror.ts', 'source-only', 'distribution', '21af1ac99d69b541f2945c1bddc956a85956103f404125058670cfa83ba78504'),
])

export const superpowersAdjunctFixture = fixture('superpowers', '6.1.1', 'd884ae04edebef577e82ff7c4e143debd0bbec99', [
  row('claude-manifest', 'identity-manifest', '.claude-plugin/plugin.json', 'claude-code', 'distribution', '475eecc40b42606656129d43d24c3ad9bedf43faeb3a85a8238988d59982f0da'),
  row('claude-marketplace', 'registration-catalog', '.claude-plugin/marketplace.json', 'claude-code', 'distribution', 'ff3f151a5a3adfdaaf9995642ac0433f4b1282f0c7a2882373bb5b7b0c3922e8'),
  row('cursor-manifest', 'identity-manifest', '.cursor-plugin/plugin.json', 'cursor', 'distribution', '9fe248cc983544d6e265bca2d512bd07b908ce81f29c841ffcb86a76c29dbf79'),
  row('codex-manifest-empty-hook-suppression', 'identity-manifest', '.codex-plugin/plugin.json', 'codex', 'distribution', '50ce01aeec3a3b13540ea43e196c25fee820739d7dbae7c52f4e7a2168b7a09f'),
  row('codex-marketplace', 'registration-catalog', '.agents/plugins/marketplace.json', 'codex', 'distribution', '2b94116c190896480e5054222a744e375976f8ae5bdb66ff0ab6b348dfad4182'),
  row('root-package', 'identity-manifest', 'package.json', 'opencode', 'distribution', 'c070d76630332e2c7d358047ba650ad88e0db76a6497f68ce79f87d51839af6f'),
  row('codex-app-icon', 'helper-payload', 'assets/app-icon.png', 'codex', 'distribution', 'b7477eb39b5109617fe37e51dd65d8bdd8dff6c40fda49adfbc21eec445777ee'),
  row('codex-logo', 'helper-payload', 'assets/superpowers-small.svg', 'codex', 'distribution', '54a632d9ee6197ccbc10d43d42217e23d08375bea63ba8eb4b6af757c1535038'),
  row('claude-hook-binding', 'lifecycle-entrypoint', 'hooks/hooks.json', 'claude-code', 'hooks', '01616c57b96cc234cc984e77d2fc241dfd0e0bfacda54fe54589cd669a0d998e'),
  row('cursor-hook-binding', 'lifecycle-entrypoint', 'hooks/hooks-cursor.json', 'cursor', 'hooks', '53d8ceb3ff5d8bb1c4f283f238cc868b8c1af22e40a3ac30f6d6e4173effefbd'),
  row('hook-wrapper', 'helper-payload', 'hooks/run-hook.cmd', 'shared', 'runtime', 'd3d9c6199678dab2858e60509dde5e7414f13c2a2b5e48a38b1d368b6e1d6abb', true),
  row('activation-helper', 'helper-payload', 'hooks/session-start', 'shared', 'runtime', '88a060272ca8047e0d1cd73a016e1cebba8396807a44be1e296d7c02dcbb9934', true),
  row('opencode-loader', 'lifecycle-entrypoint', '.opencode/plugins/superpowers.js', 'opencode', 'runtime', 'a5c5e1dbb0abfbd6ec3322b724b9a7b3318bbbb3d83f9a661c56ae0ed0a3adb8'),
  row('review-package-helper', 'helper-payload', 'skills/subagent-driven-development/scripts/review-package', 'shared', 'runtime', '0c0629f6e2c46fc8bf68dcfb8a247ab24eb548b7004fe494035e6fcba9b5cdfb', true),
  row('workspace-helper', 'helper-payload', 'skills/subagent-driven-development/scripts/sdd-workspace', 'shared', 'runtime', '9430befaff459ed862415b700c1a9efe45fd34838a684802a1d8320de0c3a007', true),
  row('task-brief-helper', 'helper-payload', 'skills/subagent-driven-development/scripts/task-brief', 'shared', 'runtime', '5380283f00bffa99ab82ae78482b7d248abe10655129c72ca7050bdc0b6a85e1', true),
  row('codex-package-policy', 'source-only-evidence', 'scripts/package-codex-plugin.sh', 'source-only', 'distribution', 'bfae2378c4ffdd80d7c71393ce2009b88c9ce6e744a4fa711b8eb33202b6bae2', true),
])

export const distributionAdjunctFixtures = [compoundEngineeringAdjunctFixture, hyperframesAdjunctFixture, superpowersAdjunctFixture] as const

export function getDistributionAdjunctFixture(name: string): DistributionAdjunctSource {
  const value = distributionAdjunctFixtures.find(candidate => candidate.provenance.fixture === name)
  if (!value) throw new Error(`Unknown distribution adjunct fixture ${name}.`)
  return value
}
