import type { MysteryCase } from "./mystery";
import type {
  MysteryContext,
  CharacterContext,
  AlibiEntry,
  WitnessEntry,
  EvidenceEntry,
  SignatureClue,
  RedHerring,
} from "./mysteryTypes";
import { getSupabaseClient } from "./mysterySupabase";

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  if (arr.length <= n) return arr;
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}

export async function enrichCase(
  c: MysteryCase,
  rng: () => number
): Promise<MysteryContext> {
  const sb = getSupabaseClient();
  if (!sb) return { byCharacter: {}, loaded: false };

  const characterIds = [c.victim.id, ...c.suspects.map((s) => s.id)];

  try {
    const [alibisRes, witnessRes, evidenceRes, cluesRes, herringsRes] =
      await Promise.all([
        sb.from("mystery_alibis").select("*").in("character_id", characterIds),
        sb
          .from("mystery_witness_statements")
          .select("*")
          .in("character_id", characterIds),
        sb
          .from("mystery_character_evidence")
          .select("*")
          .in("character_id", characterIds),
        sb
          .from("mystery_signature_clues")
          .select("*")
          .in("character_id", characterIds),
        sb
          .from("mystery_red_herrings")
          .select("*")
          .in("character_id", characterIds),
      ]);

    const byCharacter: Record<string, CharacterContext> = {};
    for (const id of characterIds) {
      const alibis: AlibiEntry[] = (alibisRes.data ?? [])
        .filter(
          (r) =>
            r.character_id === id || r.character_scope === "generic"
        )
        .map((r) => ({
          alibiId: r.alibi_id,
          characterScope: r.character_scope as "generic" | "specific",
          characterId: r.character_id,
          roomId: r.room_id,
          hour: r.hour,
          alibi: r.alibi,
        }));

      const witnesses: WitnessEntry[] = (witnessRes.data ?? [])
        .filter((r) => r.character_id === id)
        .map((r) => ({
          statementId: r.statement_id,
          characterId: r.character_id,
          statementType: r.statement_type as "true" | "false",
          statement: r.statement,
          aboutCharacter: r.about_character,
          hour: r.hour,
        }));

      const evidence: EvidenceEntry[] = (evidenceRes.data ?? [])
        .filter((r) => r.character_id === id)
        .map((r) => ({
          evidenceId: r.evidence_id,
          characterId: r.character_id,
          evidence: r.evidence,
          locationFound: r.location_found,
          forensicNote: r.forensic_note,
        }));

      const allClues: SignatureClue[] = (cluesRes.data ?? [])
        .filter((r) => r.character_id === id)
        .map((r) => ({
          clueId: r.clue_id,
          characterId: r.character_id,
          clue: r.clue,
          roomFound: r.room_found,
          misleading: r.misleading === "true",
        }));
      const clues = pickN(allClues, 2, rng);

      const allHerrings: RedHerring[] = (herringsRes.data ?? [])
        .filter((r) => r.character_id === id)
        .map((r) => ({
          redHerringId: r.red_herring_id,
          characterId: r.character_id,
          redHerring: r.red_herring,
          apparentImplication: r.apparent_implication,
          trueExplanation: r.true_explanation,
        }));
      const redHerrings = pickN(allHerrings, 1, rng);

      byCharacter[id] = { alibis, witnesses, evidence, clues, redHerrings };
    }

    return { byCharacter, loaded: true };
  } catch {
    return { byCharacter: {}, loaded: false };
  }
}
