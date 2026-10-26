import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getBook, getChapters, updateBook } from "@/lib/db/client";
import {
  generatePublishingMetadata,
  sanitizeToPlainText,
  sanitizeCoverPromptJson,
  buildNanoBananaCoverJson,
  buildDefaultSeoKeywords,
  sanitizeSeoKeywords,
  buildCleanVisualCoverPrompt,
  getCoverNegativePrompt,
  extractMetaphorFromCoverPrompt,
  generateDefaultDynamicMetaphor,
  ALLOWED_CATEGORIES,
} from "@/lib/agents/publishing-metadata-generator";

function isPathSafe(targetPath: string | null | undefined): boolean {
  if (!targetPath || typeof targetPath !== "string") return false;
  const resolved = path.resolve(targetPath);
  const dataDir = path.resolve(process.cwd(), "data");
  return (resolved === dataDir || resolved.startsWith(dataDir + path.sep)) && !resolved.includes("\0");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = getBook(id);

    if (!book) {
      return NextResponse.json({ success: false, error: "Livro não encontrado." }, { status: 404 });
    }

    const chapters = getChapters(id);

    // Se já existirem dados salvos, verificar conformidade e auto-atualizar caso falte algo
    if (book.cover_prompt && book.suggested_categories && book.marketing_description) {
      let finalCover = book.cover_prompt;
      const hasOldCardsOrDarkTheme =
        book.cover_prompt.includes('"cards"') ||
        book.cover_prompt.includes('"total_cards"') ||
        book.cover_prompt.includes('"card_shape"') ||
        book.cover_prompt.includes('"card_list"') ||
        book.cover_prompt.includes('"mode": "dark"') ||
        book.cover_prompt.includes('"mode":"dark"');

      const lacksAsymmetricOrDetails =
        !book.cover_prompt.includes('"layout_and_composition"') ||
        !book.cover_prompt.includes('"asymmetric"') ||
        !book.cover_prompt.includes('"human_ergonomics"') ||
        !book.cover_prompt.includes('"theoretical_grounding"') ||
        !book.cover_prompt.includes('"composition_geometry"') ||
        !book.cover_prompt.includes('"tactile_and_material_details"');

      const lacksKdpSpecs =
        !book.cover_prompt.includes('"output_specifications"') ||
        !book.cover_prompt.includes('"amazon_kdp_compliance"');

      const lacksWraparound =
        !book.cover_prompt.includes('"spread_zones"') ||
        !book.cover_prompt.includes('"left_zone_back_cover"') ||
        !book.cover_prompt.includes('"central_zone_spine"') ||
        !book.cover_prompt.includes('"book_cover_full_wraparound"');

      const hasOldCaliperOrNumbers =
        book.cover_prompt.includes('"scale_calibration_indices"') ||
        book.cover_prompt.includes('marcas de calibração milimétrica') ||
        book.cover_prompt.includes('"barcode_reservation_box"') ||
        book.cover_prompt.includes('crease_lines');

      const hasMarkdownOrHashInCover =
        book.cover_prompt.includes("Apresentação da Obra") ||
        book.cover_prompt.includes("O Problema Fundamental") ||
        book.cover_prompt.includes("# ") ||
        book.cover_prompt.includes("## ");

      if (hasOldCardsOrDarkTheme || lacksAsymmetricOrDetails || lacksKdpSpecs || lacksWraparound || hasOldCaliperOrNumbers || hasMarkdownOrHashInCover) {
        try {
          const parsed = JSON.parse(book.cover_prompt);
          const sanitized = sanitizeCoverPromptJson(parsed, book, chapters);
          finalCover = JSON.stringify(sanitized, null, 2);
        } catch {
          // Cura de emergência: se o JSON estiver corrompido, regenera deterministicamente
          const healed = buildNanoBananaCoverJson(book, chapters);
          finalCover = JSON.stringify(healed, null, 2);
        }

        if (finalCover !== book.cover_prompt) {
          updateBook(id, { cover_prompt: finalCover });
          book.cover_prompt = finalCover;
        }
      }

      // Auto-cura retroativa para cover_visual_prompt e cover_negative_prompt
      let visualPrompt = book.cover_visual_prompt;
      let negativePrompt = book.cover_negative_prompt;
      if (!visualPrompt || !negativePrompt || visualPrompt.includes("#") || visualPrompt.includes("Apresentação da Obra")) {
        const metaphor = extractMetaphorFromCoverPrompt(finalCover) || generateDefaultDynamicMetaphor(book, chapters);
        visualPrompt = buildCleanVisualCoverPrompt(book, chapters, metaphor);
        negativePrompt = getCoverNegativePrompt();
        updateBook(id, {
          cover_visual_prompt: visualPrompt,
          cover_negative_prompt: negativePrompt,
        });
        book.cover_visual_prompt = visualPrompt;
        book.cover_negative_prompt = negativePrompt;
      }

      // Auto-cura retroativa para livros anteriores sem seo_keywords
      let finalKeywords = book.seo_keywords;
      if (!finalKeywords) {
        const defaultKwData = buildDefaultSeoKeywords(book, chapters);
        finalKeywords = JSON.stringify(defaultKwData, null, 2);
        updateBook(id, { seo_keywords: finalKeywords });
        book.seo_keywords = finalKeywords;
      }

      return NextResponse.json({
        success: true,
        data: {
          cover_prompt: finalCover,
          cover_visual_prompt: visualPrompt,
          cover_negative_prompt: negativePrompt,
          cover_image_path: book.cover_image_path,
          cover_pdf_path: book.cover_pdf_path,
          suggested_categories: book.suggested_categories,
          marketing_description: book.marketing_description,
          seo_keywords: finalKeywords,
          allowed_categories: ALLOWED_CATEGORIES,
        },
      });
    }

    // Se ainda não gerou, gerar sob demanda
    const generated = await generatePublishingMetadata(book, chapters);

    updateBook(id, {
      cover_prompt: generated.coverPrompt,
      cover_visual_prompt: generated.coverVisualPrompt,
      cover_negative_prompt: generated.coverNegativePrompt,
      suggested_categories: generated.suggestedCategories,
      marketing_description: generated.marketingDescription,
      seo_keywords: generated.seoKeywords,
    });

    return NextResponse.json({
      success: true,
      data: {
        cover_prompt: generated.coverPrompt,
        cover_visual_prompt: generated.coverVisualPrompt,
        cover_negative_prompt: generated.coverNegativePrompt,
        cover_image_path: book.cover_image_path,
        cover_pdf_path: book.cover_pdf_path,
        suggested_categories: generated.suggestedCategories,
        marketing_description: generated.marketingDescription,
        seo_keywords: generated.seoKeywords,
        allowed_categories: ALLOWED_CATEGORIES,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao carregar metadados de publicação." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = getBook(id);

    if (!book) {
      return NextResponse.json({ success: false, error: "Livro não encontrado." }, { status: 404 });
    }

    const chapters = getChapters(id);
    const generated = await generatePublishingMetadata(book, chapters);

    updateBook(id, {
      cover_prompt: generated.coverPrompt,
      cover_visual_prompt: generated.coverVisualPrompt,
      cover_negative_prompt: generated.coverNegativePrompt,
      suggested_categories: generated.suggestedCategories,
      marketing_description: generated.marketingDescription,
      seo_keywords: generated.seoKeywords,
    });

    return NextResponse.json({
      success: true,
      data: {
        cover_prompt: generated.coverPrompt,
        cover_visual_prompt: generated.coverVisualPrompt,
        cover_negative_prompt: generated.coverNegativePrompt,
        cover_image_path: book.cover_image_path,
        cover_pdf_path: book.cover_pdf_path,
        suggested_categories: generated.suggestedCategories,
        marketing_description: generated.marketingDescription,
        seo_keywords: generated.seoKeywords,
        allowed_categories: ALLOWED_CATEGORIES,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao regenerar metadados de publicação." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = getBook(id);

    if (!book) {
      return NextResponse.json({ success: false, error: "Livro não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    let cover_prompt = book.cover_prompt;
    if (typeof body.cover_prompt === "string" && body.cover_prompt.trim().length > 0) {
      const chapters = getChapters(id);
      try {
        const parsed = JSON.parse(body.cover_prompt);
        const sanitized = sanitizeCoverPromptJson(parsed, book, chapters);
        cover_prompt = JSON.stringify(sanitized, null, 2);
      } catch {
        return NextResponse.json(
          { success: false, error: "O campo cover_prompt deve ser um JSON válido." },
          { status: 400 }
        );
      }
    }

    const cover_visual_prompt = typeof body.cover_visual_prompt === "string"
      ? body.cover_visual_prompt
      : book.cover_visual_prompt;

    const cover_negative_prompt = typeof body.cover_negative_prompt === "string"
      ? body.cover_negative_prompt
      : book.cover_negative_prompt;

    let cover_image_path = book.cover_image_path;
    if (typeof body.cover_image_path === "string") {
      if (body.cover_image_path.trim() === "") {
        cover_image_path = null;
      } else if (isPathSafe(body.cover_image_path)) {
        cover_image_path = body.cover_image_path;
      } else {
        return NextResponse.json(
          { success: false, error: "Caminho de cover_image_path inválido ou fora do diretório permitido." },
          { status: 400 }
        );
      }
    }

    let cover_pdf_path = book.cover_pdf_path;
    if (typeof body.cover_pdf_path === "string") {
      if (body.cover_pdf_path.trim() === "") {
        cover_pdf_path = null;
      } else if (isPathSafe(body.cover_pdf_path)) {
        cover_pdf_path = body.cover_pdf_path;
      } else {
        return NextResponse.json(
          { success: false, error: "Caminho de cover_pdf_path inválido ou fora do diretório permitido." },
          { status: 400 }
        );
      }
    }

    const suggested_categories = typeof body.suggested_categories === "string" ? body.suggested_categories.trim() : book.suggested_categories;
    
    let marketing_description = book.marketing_description;
    if (typeof body.marketing_description === "string") {
      let cleanDesc = sanitizeToPlainText(body.marketing_description);
      if (cleanDesc.length > 4000) {
        cleanDesc = cleanDesc.substring(0, 3996) + "...";
      }
      marketing_description = cleanDesc;
    }

    let seo_keywords = book.seo_keywords;
    if (typeof body.seo_keywords === "string" && body.seo_keywords.trim().length > 0) {
      const chapters = getChapters(id);
      const sanitized = sanitizeSeoKeywords(body.seo_keywords, book, chapters);
      seo_keywords = JSON.stringify(sanitized, null, 2);
    }

    updateBook(id, {
      cover_prompt,
      cover_visual_prompt,
      cover_negative_prompt,
      cover_image_path,
      cover_pdf_path,
      suggested_categories,
      marketing_description,
      seo_keywords,
    });

    return NextResponse.json({
      success: true,
      data: {
        cover_prompt,
        cover_visual_prompt,
        cover_negative_prompt,
        cover_image_path,
        cover_pdf_path,
        suggested_categories,
        marketing_description,
        seo_keywords,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao atualizar metadados de publicação." },
      { status: 500 }
    );
  }
}
