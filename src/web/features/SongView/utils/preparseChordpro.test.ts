import { describe, it, expect } from "vitest";
import { preparseDirectives } from "./preparseChordpro";

describe("preparseChordpro Directives", () => {
  describe("should correctly store and recall", () => {
    it("a basic verse with both expanded and shorthand formats", () => {
      const input = `
{start_of_verse}
[C]This is the verse
[G]It is very nice
{end_of_verse}

{verse}
    `.trim();

      const expected = `
{start_of_verse}
[C]This is the verse
[G]It is very nice
{end_of_verse}
{start_of_verse}
{comment: %expanded_section%}
[C]This is the verse
[G]It is very nice
{end_of_verse}
{start_of_verse}
{comment: %shorthand_section%}
{comment: %section_title: V%}
{end_of_verse}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
    it("a labelled verse with both expanded and shorthand formats", () => {
      const input = `
{start_of_verse: V1}
[C]This is the verse
[G]It is very nice
{end_of_verse}

{verse: V1}
    `.trim();

      const expected = `
{start_of_verse: V1}
{comment: %section_title: V1%}
[C]This is the verse
[G]It is very nice
{end_of_verse}
{start_of_verse: V1}
{comment: %expanded_section%}
{comment: %section_title: V1%}
[C]This is the verse
[G]It is very nice
{end_of_verse}
{start_of_verse}
{comment: %shorthand_section%}
{comment: %section_title: V1%}
{end_of_verse}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
    it("a basic bridge with both expanded and shorthand formats", () => {
      const input = `
{start_of_bridge}
[C]This is the bridge
[G]It is very nice
{end_of_bridge}

{bridge}
    `.trim();

      const expected = `
{start_of_bridge}
{comment: %section_title: B%}
[C]This is the bridge
[G]It is very nice
{end_of_bridge}
{start_of_bridge}
{comment: %expanded_section%}
{comment: %section_title: B%}
[C]This is the bridge
[G]It is very nice
{end_of_bridge}
{start_of_bridge}
{comment: %shorthand_section%}
{comment: %section_title: B%}
{end_of_bridge}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
    it("a labelled bridge with both expanded and shorthand formats", () => {
      const input = `
{start_of_bridge: B1}
[C]This is the bridge
[G]It is very nice
{end_of_bridge}

{bridge: B1}
    `.trim();

      const expected = `
{start_of_bridge: B1}
{comment: %section_title: B1%}
[C]This is the bridge
[G]It is very nice
{end_of_bridge}
{start_of_bridge: B1}
{comment: %expanded_section%}
{comment: %section_title: B1%}
[C]This is the bridge
[G]It is very nice
{end_of_bridge}
{start_of_bridge}
{comment: %shorthand_section%}
{comment: %section_title: B1%}
{end_of_bridge}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
    it("a basic chorus with both expanded and shorthand formats", () => {
      const input = `
{start_of_chorus}
[C]This is the chorus
[G]It is very nice
{end_of_chorus}

{chorus}
    `.trim();

      const expected = `
{start_of_chorus}
{comment: %section_title: R%}
[C]This is the chorus
[G]It is very nice
{end_of_chorus}
{start_of_chorus}
{comment: %expanded_section%}
{comment: %section_title: R%}
[C]This is the chorus
[G]It is very nice
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: R%}
{end_of_chorus}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
    it("a labelled chorus with both expanded and shorthand formats", () => {
      const input = `
{start_of_chorus: R1}
[C]This is the chorus
[G]It is very nice
{end_of_chorus}

{chorus: R1}
    `.trim();

      const expected = `
{start_of_chorus: R1}
{comment: %section_title: R1%}
[C]This is the chorus
[G]It is very nice
{end_of_chorus}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
[C]This is the chorus
[G]It is very nice
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: R1%}
{end_of_chorus}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
  });
  describe("should gracefully", () => {
    it("leave parts without a section label as they are", () => {
      const input = `
[C]Part without a section[D]
{start_of_verse}
[C]Verse 1
{end_of_verse}
    `.trim();

      const expected = `
[C]Part without a section[D]
{start_of_verse}
[C]Verse 1
{end_of_verse}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
    it("degrade on an undefined section recall instead of throwing or deleting lyrics", () => {
      const input = `
{start_of_verse}
[C]Verse 1
{end_of_verse}
{chorus: R1}
    `.trim();

      const expected = `
{start_of_verse}
[C]Verse 1
{end_of_verse}
{comment: Error: Recalled part "chorus" not found. No previous section recorded.}
{chorus: R1}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
    it("comment on erroneous recalls from within sections", () => {
      const input = `
{start_of_chorus}
[G] Chorus [D]
{end_of_chorus}
{start_of_verse}
[C]Verse 1
{chorus}
{end_of_verse}
    `.trim();

      const expected = `
{start_of_chorus}
{comment: %section_title: R%}
[G] Chorus [D]
{end_of_chorus}
{start_of_verse}
[C]Verse 1
{comment: Error: Cannot recall from within a section.}
{end_of_verse}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
    it("degrade on an invalid variant type without losing variant text", () => {
      const input = `
{start_of_chorus}
Line 1
{end_of_chorus}

{start_of_variant: absolute_garbage}
Lost lyrics that are very important
{end_of_variant}
{chorus}
    `.trim();

      const expected = `
{start_of_chorus}
{comment: %section_title: R%}
Line 1
{end_of_chorus}
{comment: Invalid variant type: absolute_garbage}
{comment: Warning: Lost variant contents applied here.}
Lost lyrics that are very important
{start_of_chorus}
{comment: %expanded_section%}
{comment: %section_title: R%}
Line 1
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: R%}
{end_of_chorus}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
  });
  it("should condense consecutive identical recalls into a multiplier", () => {
    const input = `
{start_of_chorus: R1}
A great chorus
{end_of_chorus}

{chorus: R1}
{chorus: R1}
{chorus: R1}
    `.trim();

    const expected = `
{start_of_chorus: R1}
{comment: %section_title: R1%}
A great chorus
{end_of_chorus}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
A great chorus
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: (3x) R1%}
{end_of_chorus}
    `.trim();

    const result = preparseDirectives(input);
    expect(result).toBe(expected);
  });

  // --- COMPREHENSIVE VARIANT TESTS ---

  describe("should correctly apply variant", () => {
    it("prepend_content", () => {
      const input = `
{start_of_chorus: R1}
Line 1
{end_of_chorus}

{start_of_variant: prepend_content}
Pre Line
{end_of_variant}
{chorus: R1}
    `.trim();

      const expected = `
{start_of_chorus: R1}
{comment: %section_title: R1%}
Line 1
{end_of_chorus}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
Pre Line
Line 1
{end_of_chorus}
{start_of_chorus: R1}
{comment: %shorthand_section%}
{comment: %section_title: R1%}
Pre Line+
Line 1
{end_of_chorus}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });

    it("replace_first_line", () => {
      const input = `
{start_of_chorus: R1}
Line 1
Line 2
{end_of_chorus}

{start_of_variant: replace_first_line}
New Line 1
{end_of_variant}
{chorus: R1}
    `.trim();

      const expected = `
{start_of_chorus: R1}
{comment: %section_title: R1%}
Line 1
Line 2
{end_of_chorus}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
New Line 1
Line 2
{end_of_chorus}
{start_of_chorus: R1}
{comment: %shorthand_section%}
{comment: %section_title: R1%}
New Line 1...
{end_of_chorus}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });

    it("append_content", () => {
      const input = `
{start_of_chorus: R1}
Line 1
{end_of_chorus}

{start_of_variant: append_content}
Extra Line
{end_of_variant}
{chorus: R1}
    `.trim();

      const expected = `
{start_of_chorus: R1}
{comment: %section_title: R1%}
Line 1
{end_of_chorus}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
Line 1
Extra Line
{end_of_chorus}
{start_of_chorus: R1}
{comment: %shorthand_section%}
{comment: %section_title: R1%}
+ Extra Line
{end_of_chorus}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });

    it("replace_last_line", () => {
      const input = `
{start_of_chorus: R1}
Line 1
Line 2
{end_of_chorus}

{start_of_variant: replace_last_line}
Variant Line
{end_of_variant}
{chorus: R1}
    `.trim();

      const expected = `
{start_of_chorus: R1}
{comment: %section_title: R1%}
Line 1
Line 2
{end_of_chorus}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
Line 1
Variant Line
{end_of_chorus}
{start_of_chorus: R1}
{comment: %shorthand_section%}
{comment: %section_title: R1%}
...Variant Line
{end_of_chorus}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });

    it("dynamic replace_last_n_lines", () => {
      const input = `
{start_of_chorus: R1}
Line 1
Line 2
Line 3
Line 4
{end_of_chorus}

{start_of_variant: replace_last_n_lines: 2}
Variant Line A
Variant Line B
{end_of_variant}
{chorus: R1}
    `.trim();

      const expected = `
{start_of_chorus: R1}
{comment: %section_title: R1%}
Line 1
Line 2
Line 3
Line 4
{end_of_chorus}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
Line 1
Line 2
Variant Line A
Variant Line B
{end_of_chorus}
{start_of_chorus: R1}
{comment: %shorthand_section%}
{comment: %section_title: R1%}
...Variant Line A
Variant Line B
{end_of_chorus}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
  });
  describe("should handle complex cases", () => {
    it("Zdeněk Piškula: Balič Novodobý", () => {
      const input = `
{start_of_chorus: R1}
[F]Ratatatatatadau
[Ami]Ratatatatýdydau
[Dmi]Ratatatatádadapau
[B]Ratatatapapadapau
{end_of_chorus}

{start_of_verse}
[F]Každý ráno, hned jak vstanu,
[A]rozešlu selfie v županu,
[Dmi]a pak čekám lajků stovky,
[B]u svý nový profilovky.
{end_of_verse}

{start_of_verse}
[F]Se svou image alfa samce,
[A]balím buchty na seznamce,
[Dmi]nevadí mi když se mračí,
[B]pošlou smajlík, a to stačí.
{end_of_verse}

{start_of_verse}
[F]Z posilovny, v cuku letu,
[A]fotku mou máš na snapchatu,
[Dmi]z instagramu moje krásky,
[B]rozdávaj mi lajky z lásky.
{end_of_verse}

{start_of_bridge}
[F]Nosit slečnám [Ami]kytky,
to se [B]dneska neno[Bmi]sí,
a [Bmi]v tramvaji je pouštím sednout,
[C]jen když poprosí...
{end_of_bridge}

{start_of_chorus: R2}
No tak..[F]. ať se na mě klidně zlobí,
[Ami]gentlemani ze záhrobí,
[Dmi]všechny slečny, berou mdloby,
[B]je tu balič novodobý,
{end_of_chorus}

{start_of_verse}
[F]Vaše lajky zeď mou zdobí,
[A]sbírám si je do zásoby,
[Dmi]jistě na vás zapůsobí,
[B]tenhle balič novodobý,
{end_of_verse}

{chorus: R1}

{start_of_verse}
[F]Dnešní lásce pubertální,
[A]něžnost stačí virtuální,
[Dmi]na co dívce hladit ruku,
[B]stačí šťouchat na facebooku.
{end_of_verse}

{start_of_verse}
[F]Co maj holky nejvíc rády,
[A]číst můj twitter, moje rady,
[Dmi]budu rád když lajkneš kotě,
[B]mý statusy o životě.
{end_of_verse}

{start_of_verse}
[F]Holky se se mnou randit bojí,
[A]když jsme venku, tak řeč stojí,
[Dmi]nevím jakou říct otázku,
[B]všechno o ní už vím z asku.
{end_of_verse}

{start_of_bridge}
[F]Že tě rád mám,[Ami]snad už víš,
to se [B]dneska neno[Bmi]sí,
a [Bmi]v tramvaji je pouštím sednout,
[C]když můžem dál jen, chatovat
{end_of_bridge}

{chorus: R1}
{chorus: R2}
    `.trim();

      const expected = `
{start_of_chorus: R1}
{comment: %section_title: R1%}
[F]Ratatatatatadau
[Ami]Ratatatatýdydau
[Dmi]Ratatatatádadapau
[B]Ratatatapapadapau
{end_of_chorus}
{start_of_verse}
[F]Každý ráno, hned jak vstanu,
[A]rozešlu selfie v županu,
[Dmi]a pak čekám lajků stovky,
[B]u svý nový profilovky.
{end_of_verse}
{start_of_verse}
[F]Se svou image alfa samce,
[A]balím buchty na seznamce,
[Dmi]nevadí mi když se mračí,
[B]pošlou smajlík, a to stačí.
{end_of_verse}
{start_of_verse}
[F]Z posilovny, v cuku letu,
[A]fotku mou máš na snapchatu,
[Dmi]z instagramu moje krásky,
[B]rozdávaj mi lajky z lásky.
{end_of_verse}
{start_of_bridge}
{comment: %section_title: B%}
[F]Nosit slečnám [Ami]kytky,
to se [B]dneska neno[Bmi]sí,
a [Bmi]v tramvaji je pouštím sednout,
[C]jen když poprosí...
{end_of_bridge}
{start_of_chorus: R2}
{comment: %section_title: R2%}
No tak..[F]. ať se na mě klidně zlobí,
[Ami]gentlemani ze záhrobí,
[Dmi]všechny slečny, berou mdloby,
[B]je tu balič novodobý,
{end_of_chorus}
{start_of_verse}
[F]Vaše lajky zeď mou zdobí,
[A]sbírám si je do zásoby,
[Dmi]jistě na vás zapůsobí,
[B]tenhle balič novodobý,
{end_of_verse}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
[F]Ratatatatatadau
[Ami]Ratatatatýdydau
[Dmi]Ratatatatádadapau
[B]Ratatatapapadapau
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: R1%}
{end_of_chorus}
{start_of_verse}
[F]Dnešní lásce pubertální,
[A]něžnost stačí virtuální,
[Dmi]na co dívce hladit ruku,
[B]stačí šťouchat na facebooku.
{end_of_verse}
{start_of_verse}
[F]Co maj holky nejvíc rády,
[A]číst můj twitter, moje rady,
[Dmi]budu rád když lajkneš kotě,
[B]mý statusy o životě.
{end_of_verse}
{start_of_verse}
[F]Holky se se mnou randit bojí,
[A]když jsme venku, tak řeč stojí,
[Dmi]nevím jakou říct otázku,
[B]všechno o ní už vím z asku.
{end_of_verse}
{start_of_bridge}
{comment: %section_title: B%}
[F]Že tě rád mám,[Ami]snad už víš,
to se [B]dneska neno[Bmi]sí,
a [Bmi]v tramvaji je pouštím sednout,
[C]když můžem dál jen, chatovat
{end_of_bridge}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
[F]Ratatatatatadau
[Ami]Ratatatatýdydau
[Dmi]Ratatatatádadapau
[B]Ratatatapapadapau
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: R1%}
{end_of_chorus}
{start_of_chorus: R2}
{comment: %expanded_section%}
{comment: %section_title: R2%}
No tak..[F]. ať se na mě klidně zlobí,
[Ami]gentlemani ze záhrobí,
[Dmi]všechny slečny, berou mdloby,
[B]je tu balič novodobý,
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: R2%}
{end_of_chorus}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
    it("K'naan: Wavin' flag", () => {
      const input = `
{start_of_chorus: Ooo}
𝄆 [C]oooo,[F]ooo,[Am]ooooo[G] 𝄇
{end_of_chorus}

{start_of_verse}
[C]Give me freedom, [F]give me fire
[Am]give me reason, [G]take me higher
[C]see the champions, [F]take the field now
[Am]unify us, [G]make us feel proud.
{end_of_verse}

{start_of_verse}
[C]En las calles, [F]muchas manos,
[Am]levantadas [G]celebrando,
[C]una fiesta [F]sin descanso,
[Am]los paìses [G]como hermanos
{end_of_verse}

{start_of_bridge: Pre-chorus}
[C]Canta y une tu [F]voz,
grita fu[Am]erte que te escuche el [G]sol,
el part[C]ido ya va a comenz[F]ar,
todos j[Am]untos vamos a gan[G]ar
{end_of_bridge}

{start_of_chorus: ES}
Unidos [C]seremos grandes, [F]seremos fuertes
s[Am]omos un pueblo [G]bandera de libert[C]ad,
que viene y que [F]va que viene y que [Am]va,
que viene y que [G]va que viene y que [C]va
{end_of_chorus}

{start_of_chorus: EN}
[C]When I get older, [F]I will be stronger!
[Am]they'll call me freedom,
[G]just like the waving fl[C]ag!
𝄆 Now wave your [F]flag now wave your f[Am]lag
now wave your [G]flag now wave your [C]flag 𝄇
{end_of_chorus}

{chorus: Ooo}

{start_of_verse}
[C]Da nos vida, [F]danos fuego,
[Am]que nos lleve [G]a lo alto,
[C]campeones [F]o vencidos,
[Am]pero unidos [G]a intentarlo,
{end_of_verse}

{start_of_verse}
[C]In the streets our [F]hands are liftin',
[Am]as we lose our [G]inhibitions
[C]celebration [F]is around us,
[Am]every nation [G]all around us!
{end_of_verse}

{start_of_bridge: Pre-chorus}
[C]Singing forever [F]young,
singing s[Am]ongs underneath the [G]sun!
let's rej[C]oice the beautiful [F]game
and tog[Am]ether at the end of the [G]day
we all say
{end_of_bridge}

{chorus: ES}
{chorus: EN}

{chorus: Ooo}
    `.trim();

      const expected = `
{start_of_chorus: Ooo}
{comment: %section_title: Ooo%}
𝄆 [C]oooo,[F]ooo,[Am]ooooo[G] 𝄇
{end_of_chorus}
{start_of_verse}
[C]Give me freedom, [F]give me fire
[Am]give me reason, [G]take me higher
[C]see the champions, [F]take the field now
[Am]unify us, [G]make us feel proud.
{end_of_verse}
{start_of_verse}
[C]En las calles, [F]muchas manos,
[Am]levantadas [G]celebrando,
[C]una fiesta [F]sin descanso,
[Am]los paìses [G]como hermanos
{end_of_verse}
{start_of_bridge: Pre-chorus}
{comment: %section_title: Pre-chorus%}
[C]Canta y une tu [F]voz,
grita fu[Am]erte que te escuche el [G]sol,
el part[C]ido ya va a comenz[F]ar,
todos j[Am]untos vamos a gan[G]ar
{end_of_bridge}
{start_of_chorus: ES}
{comment: %section_title: ES%}
Unidos [C]seremos grandes, [F]seremos fuertes
s[Am]omos un pueblo [G]bandera de libert[C]ad,
que viene y que [F]va que viene y que [Am]va,
que viene y que [G]va que viene y que [C]va
{end_of_chorus}
{start_of_chorus: EN}
{comment: %section_title: EN%}
[C]When I get older, [F]I will be stronger!
[Am]they'll call me freedom,
[G]just like the waving fl[C]ag!
𝄆 Now wave your [F]flag now wave your f[Am]lag
now wave your [G]flag now wave your [C]flag 𝄇
{end_of_chorus}
{start_of_chorus: Ooo}
{comment: %expanded_section%}
{comment: %section_title: Ooo%}
𝄆 [C]oooo,[F]ooo,[Am]ooooo[G] 𝄇
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: Ooo%}
{end_of_chorus}
{start_of_verse}
[C]Da nos vida, [F]danos fuego,
[Am]que nos lleve [G]a lo alto,
[C]campeones [F]o vencidos,
[Am]pero unidos [G]a intentarlo,
{end_of_verse}
{start_of_verse}
[C]In the streets our [F]hands are liftin',
[Am]as we lose our [G]inhibitions
[C]celebration [F]is around us,
[Am]every nation [G]all around us!
{end_of_verse}
{start_of_bridge: Pre-chorus}
{comment: %section_title: Pre-chorus%}
[C]Singing forever [F]young,
singing s[Am]ongs underneath the [G]sun!
let's rej[C]oice the beautiful [F]game
and tog[Am]ether at the end of the [G]day
we all say
{end_of_bridge}
{start_of_chorus: ES}
{comment: %expanded_section%}
{comment: %section_title: ES%}
Unidos [C]seremos grandes, [F]seremos fuertes
s[Am]omos un pueblo [G]bandera de libert[C]ad,
que viene y que [F]va que viene y que [Am]va,
que viene y que [G]va que viene y que [C]va
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: ES%}
{end_of_chorus}
{start_of_chorus: EN}
{comment: %expanded_section%}
{comment: %section_title: EN%}
[C]When I get older, [F]I will be stronger!
[Am]they'll call me freedom,
[G]just like the waving fl[C]ag!
𝄆 Now wave your [F]flag now wave your f[Am]lag
now wave your [G]flag now wave your [C]flag 𝄇
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: EN%}
{end_of_chorus}
{start_of_chorus: Ooo}
{comment: %expanded_section%}
{comment: %section_title: Ooo%}
𝄆 [C]oooo,[F]ooo,[Am]ooooo[G] 𝄇
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: Ooo%}
{end_of_chorus}
    `.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
    it("Traband: Vlaštovky", () => {
      const input = `
{start_of_verse: Intro}
Óóó[Dmi][Ami][B][F][Dmi][Ami][B][F]
Óóó[Dmi][Ami][B][F][Dmi][Ami][F][G][A]
{end_of_verse}

{start_of_verse}
[Dmi]Každé jaro [Ami]z velké dáli,
[B]vlaštovky k nám [F]přilétaly,
[Dmi]někdy až [C]dovnitř do stave[Ami]ní.
{end_of_verse}

{start_of_verse}
[Dmi]Pod střechou se [Ami]uhnízdily
[B]a lidé, kteří [F]uvnitř žili,
[Dmi]rozuměli [C]jejich švitoře[Ami]ní.
{end_of_verse}

{start_of_chorus: R1}
[Dmi]O dalekých [Ami]krajích,
hlubokých [B]mořích, divokých [F]řekách,
o vysokých [Dmi]horách,
které je [C]nutné přelét[Ami]nout.

[Dmi]O nebeských [Ami]stezkách,
zářících [B]hvězdách, o cestách [F]domů,
o korunách [Dmi]stromů,
kde je [C]možné odpoči[Ami]nout.
{end_of_chorus}

{verse: Intro}

{start_of_verse}
[Dmi]Jsme z míst, která [Ami]jsme zabydlili,
[B]z hnízd, která jsme [F]opustili,
[Dmi]z cest, které [C]končí na bře[Ami]hu.
{end_of_verse}

{start_of_verse}
[Dmi]Jsme z lidí i [Ami]z všech bytostí,
[B]jsme z krve, [F]z masa, z kostí,
[Dmi]jsme ze vzpomínek, [C]snů a z příbě[Ami]hů.
{end_of_verse}

{start_of_chorus}
[Dmi]Jsme jako ti [Ami]ptáci,
z papíru [B]draci, létáme v [F]mracích
a pak se [Dmi]vracíme zpátky
tam, kde při[C]poutaní [Ami]jsme.

[Dmi]Jsme lidské by[Ami]tosti
z masa a [B]kostí, jsme jenom [F]hosti
na tomhle [Dmi]světě,
přicházíme, [C]odchází[Ami]me.
{end_of_chorus}

{start_of_chorus}
[Dmi]A chceme mít [Ami]jisto,
že někde [B]místo, že někde je [F]hnízdo,
odkud jsme [Dmi]přišli
a kam zas [C]potom půjdeme [Ami]spát,

[Dmi]Že někde je [Ami]domov,
že někde je [B]hnízdo, útulno [F]čisto,
že někde je [Dmi]někdo,
kdo čeká na [C]nás, na ná[Ami]vrat.
{end_of_chorus}

{start_of_variant: replace_first_line}
[Dmi]Tam v dalekých [Ami]krajích,
{end_of_variant}
{chorus: R1}
{chorus: R1}

{verse: Intro}`.trim();

      const expected = `{start_of_verse: Intro}
{comment: %section_title: Intro%}
Óóó[Dmi][Ami][B][F][Dmi][Ami][B][F]
Óóó[Dmi][Ami][B][F][Dmi][Ami][F][G][A]
{end_of_verse}
{start_of_verse}
[Dmi]Každé jaro [Ami]z velké dáli,
[B]vlaštovky k nám [F]přilétaly,
[Dmi]někdy až [C]dovnitř do stave[Ami]ní.
{end_of_verse}
{start_of_verse}
[Dmi]Pod střechou se [Ami]uhnízdily
[B]a lidé, kteří [F]uvnitř žili,
[Dmi]rozuměli [C]jejich švitoře[Ami]ní.
{end_of_verse}
{start_of_chorus: R1}
{comment: %section_title: R1%}
[Dmi]O dalekých [Ami]krajích,
hlubokých [B]mořích, divokých [F]řekách,
o vysokých [Dmi]horách,
které je [C]nutné přelét[Ami]nout.

[Dmi]O nebeských [Ami]stezkách,
zářících [B]hvězdách, o cestách [F]domů,
o korunách [Dmi]stromů,
kde je [C]možné odpoči[Ami]nout.
{end_of_chorus}
{start_of_verse: Intro}
{comment: %expanded_section%}
{comment: %section_title: Intro%}
Óóó[Dmi][Ami][B][F][Dmi][Ami][B][F]
Óóó[Dmi][Ami][B][F][Dmi][Ami][F][G][A]
{end_of_verse}
{start_of_verse}
{comment: %shorthand_section%}
{comment: %section_title: Intro%}
{end_of_verse}
{start_of_verse}
[Dmi]Jsme z míst, která [Ami]jsme zabydlili,
[B]z hnízd, která jsme [F]opustili,
[Dmi]z cest, které [C]končí na bře[Ami]hu.
{end_of_verse}
{start_of_verse}
[Dmi]Jsme z lidí i [Ami]z všech bytostí,
[B]jsme z krve, [F]z masa, z kostí,
[Dmi]jsme ze vzpomínek, [C]snů a z příbě[Ami]hů.
{end_of_verse}
{start_of_chorus}
{comment: %section_title: R%}
[Dmi]Jsme jako ti [Ami]ptáci,
z papíru [B]draci, létáme v [F]mracích
a pak se [Dmi]vracíme zpátky
tam, kde při[C]poutaní [Ami]jsme.

[Dmi]Jsme lidské by[Ami]tosti
z masa a [B]kostí, jsme jenom [F]hosti
na tomhle [Dmi]světě,
přicházíme, [C]odchází[Ami]me.
{end_of_chorus}
{start_of_chorus}
{comment: %section_title: R%}
[Dmi]A chceme mít [Ami]jisto,
že někde [B]místo, že někde je [F]hnízdo,
odkud jsme [Dmi]přišli
a kam zas [C]potom půjdeme [Ami]spát,

[Dmi]Že někde je [Ami]domov,
že někde je [B]hnízdo, útulno [F]čisto,
že někde je [Dmi]někdo,
kdo čeká na [C]nás, na ná[Ami]vrat.
{end_of_chorus}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
[Dmi]Tam v dalekých [Ami]krajích,
hlubokých [B]mořích, divokých [F]řekách,
o vysokých [Dmi]horách,
které je [C]nutné přelét[Ami]nout.

[Dmi]O nebeských [Ami]stezkách,
zářících [B]hvězdách, o cestách [F]domů,
o korunách [Dmi]stromů,
kde je [C]možné odpoči[Ami]nout.
{end_of_chorus}
{start_of_chorus: R1}
{comment: %shorthand_section%}
{comment: %section_title: R1%}
[Dmi]Tam v dalekých [Ami]krajích,...
{end_of_chorus}
{start_of_chorus: R1}
{comment: %expanded_section%}
{comment: %section_title: R1%}
[Dmi]O dalekých [Ami]krajích,
hlubokých [B]mořích, divokých [F]řekách,
o vysokých [Dmi]horách,
které je [C]nutné přelét[Ami]nout.

[Dmi]O nebeských [Ami]stezkách,
zářících [B]hvězdách, o cestách [F]domů,
o korunách [Dmi]stromů,
kde je [C]možné odpoči[Ami]nout.
{end_of_chorus}
{start_of_chorus}
{comment: %shorthand_section%}
{comment: %section_title: R1%}
{end_of_chorus}
{start_of_verse: Intro}
{comment: %expanded_section%}
{comment: %section_title: Intro%}
Óóó[Dmi][Ami][B][F][Dmi][Ami][B][F]
Óóó[Dmi][Ami][B][F][Dmi][Ami][F][G][A]
{end_of_verse}
{start_of_verse}
{comment: %shorthand_section%}
{comment: %section_title: Intro%}
{end_of_verse}`.trim();

      const result = preparseDirectives(input);
      expect(result).toBe(expected);
    });
  });
});
