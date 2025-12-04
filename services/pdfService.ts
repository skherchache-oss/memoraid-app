
import { PDFDocument, rgb, PDFFont, StandardFonts, PDFPage } from 'pdf-lib';
import type { CognitiveCapsule, FlashcardContent } from '../types';

// Utility to trigger blob download.
export const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};


// --- PDF Generation Core ---

// In-memory counter to track downloads per day for sequential numbering.
const downloadCounter: { [key: string]: number } = {};

export const generateFilename = (prefix: string, title: string, extension: string): string => {
    // 1. Get the current date in YYYY-MM-DD format.
    const date = new Date().toISOString().slice(0, 10);

    // 2. Extract a relevant keyword from the title.
    const stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'à', 'au', 'aux', 'en', 'et', 'ou', 'pour', 'sur', 'les', 'des', 'avec']);
    const sanitizedTitle = title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, '');
    const words = sanitizedTitle.split(/\s+/).filter(word => word && !stopWords.has(word));
    const keyword = words[0] || 'sans-titre';

    // 3. Get and increment the sequential number for the day.
    const counterKey = `${prefix}_${keyword}_${date}`;
    downloadCounter[counterKey] = (downloadCounter[counterKey] || 0) + 1;
    const sequenceNumber = String(downloadCounter[counterKey]).padStart(3, '0');

    // 4. Assemble the final filename.
    return `${prefix}_${keyword}_${date}_${sequenceNumber}.${extension}`;
};


const FONT_SIZES = {
    h1: 22,
    h2: 16,
    h3: 12,
    body: 10,
    small: 8,
};
const LINE_HEIGHT_MULTIPLIER = 1.4;
const MARGIN = 50; // in points

// Helper to sanitize text for WinAnsi encoding (StandardFonts)
// This prevents crashes when AI generates emojis or unsupported chars
const sanitizeText = (text: string): string => {
    if (!text) return '';
    return text
        .replace(/[\u2018\u2019]/g, "'") // Smart quotes
        .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
        .replace(/[\u2013\u2014]/g, '-') // Dashes
        .replace(/…/g, '...') // Ellipsis
        .replace(/€/g, 'EUR')
        .replace(/œ/g, 'oe')
        .replace(/Œ/g, 'OE')
        .replace(/[^\x00-\xFF]/g, '') // Strip non-WinAnsi chars (emojis, etc)
        .replace(/\r/g, '');
};

// Helper to wrap text
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    const sanitized = sanitizeText(text);
    // Split by newlines first to preserve paragraph structure
    const paragraphs = sanitized.split('\n');
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        let currentLine = '';

        for (const word of words) {
            if (!word) continue;
            const testLine = currentLine === '' ? word : `${currentLine} ${word}`;
            
            try {
                const width = font.widthOfTextAtSize(testLine, fontSize);
                if (width < maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            } catch (e) {
                // Fallback if specific char fails measurement
                lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
    }
    return lines;
}

// Helper to draw branding (MEMORAID Logo) on a page
const drawBranding = (page: PDFPage, fontBold: PDFFont) => {
    const { width, height } = page.getSize();
    page.drawText('MEMORAID', {
        x: width - 100, // Top right position
        y: height - 30,
        size: 10,
        font: fontBold,
        color: rgb(0.02, 0.59, 0.41), // Emerald 600 (#059669) - Brand Color
    });
};

// Helper to draw text with automatic page breaks
async function drawText(context: { doc: PDFDocument, page: PDFPage, cursor: { y: number }, fontBold: PDFFont }, text: string, options: {
    font: PDFFont;
    fontSize?: number;
    spaceAfter?: number;
}) {
    const { doc, cursor, fontBold } = context;
    const { font } = options;
    // Use context.page directly to avoid stale references after page breaks.
    const maxWidth = context.page.getSize().width - 2 * MARGIN;
    
    const fontSize = options.fontSize || FONT_SIZES.body;
    const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
    const spaceAfter = options.spaceAfter || 0;
    
    // wrapText now handles sanitization
    const lines = wrapText(text, font, fontSize, maxWidth);

    for (const line of lines) {
        if (cursor.y - lineHeight < MARGIN) {
            context.page = doc.addPage();
            drawBranding(context.page, fontBold); // Add branding to new page
            cursor.y = context.page.getHeight() - MARGIN;
        }
        context.page.drawText(line, {
            x: MARGIN,
            y: cursor.y - fontSize, // Adjust for baseline
            font: font,
            size: fontSize,
            color: rgb(0.1, 0.1, 0.1),
        });
        cursor.y -= lineHeight;
    }
    cursor.y -= spaceAfter;
}


// --- Content Drawing Functions ---

const drawCapsuleContent = async (doc: PDFDocument, capsule: CognitiveCapsule) => {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    
    const context: { doc: PDFDocument, page: PDFPage, cursor: { y: number }, fontBold: PDFFont } = {
        doc: doc,
        page: doc.addPage(),
        cursor: { y: 0 },
        fontBold: fontBold
    };
    context.cursor.y = context.page.getHeight() - MARGIN;
    
    // Branding on first page
    drawBranding(context.page, fontBold);

    await drawText(context, capsule.title, { font: fontBold, fontSize: FONT_SIZES.h1, spaceAfter: 10 }); // Use Bold for title
    await drawText(context, capsule.summary, { font, fontSize: FONT_SIZES.body, spaceAfter: 20 });
    
    await drawText(context, 'Concepts Clés', { font: fontBold, fontSize: FONT_SIZES.h2, spaceAfter: 10 });
    const maxWidth = context.page.getSize().width - 2 * MARGIN;
    const lightBlue = rgb(0.93, 0.95, 1); // Very light blue color

    for (const c of capsule.keyConcepts) {
        const spaceAfterConcept = 2;
        const spaceAfterExplanation = 15;
        const PADDING = 10;

        // 1. Calculate the height of the concept block to prevent page-splitting inside a concept.
        const conceptLines = wrapText(c.concept, fontBold, FONT_SIZES.h3, maxWidth);
        const explanationLines = wrapText(c.explanation, font, FONT_SIZES.body, maxWidth);
        const conceptHeight = conceptLines.length * (FONT_SIZES.h3 * LINE_HEIGHT_MULTIPLIER);
        const explanationHeight = explanationLines.length * (FONT_SIZES.body * LINE_HEIGHT_MULTIPLIER);
        const contentHeight = conceptHeight + spaceAfterConcept + explanationHeight;
        
        // 2. If the block (with padding) doesn't fit, move to a new page.
        // NOTE: If contentHeight is huge (larger than a page), this check handles moving to top of next page,
        // but doesn't split the background rect. This is acceptable for now as concepts are usually short.
        if (context.cursor.y - (contentHeight + PADDING) < MARGIN) {
            context.page = doc.addPage();
            drawBranding(context.page, fontBold); // Add branding to new page
            context.cursor.y = context.page.getHeight() - MARGIN;
        }
        
        const startY = context.cursor.y;

        // 3. Draw the background rectangle with padding.
        // Only draw if we have space, otherwise we are already at top of page
        if (contentHeight < context.page.getHeight() - 2*MARGIN) {
             context.page.drawRectangle({
                x: MARGIN - PADDING / 2,
                y: startY - contentHeight - PADDING / 2,
                width: maxWidth + PADDING,
                height: contentHeight + PADDING,
                color: lightBlue,
            });
        }

        // 4. Draw the text on top of the rectangle.
        await drawText(context, c.concept, { font: fontBold, fontSize: FONT_SIZES.h3, spaceAfter: spaceAfterConcept });
        await drawText(context, c.explanation, { font, fontSize: FONT_SIZES.body, spaceAfter: spaceAfterExplanation });
    }
    
    await drawText(context, 'Exemples Pratiques', { font: fontBold, fontSize: FONT_SIZES.h2, spaceAfter: 10 });
    for (const e of capsule.examples) {
        await drawText(context, `• ${e}`, { font, fontSize: FONT_SIZES.body, spaceAfter: 8 });
    }
};

const drawFlashcards = async (doc: PDFDocument, flashcards: FlashcardContent[]) => {
    if (!flashcards || flashcards.length === 0) return;

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const COLUMNS = 2;
    const ROWS = 4;
    const CARDS_PER_PAGE = COLUMNS * ROWS;
    const GUTTER = 15;

    let cardCounter = 0;
    let page: PDFPage | null = null;

    // Calculate font size to fit content
    const calculateFitFontSize = (text: string, font: PDFFont, maxWidth: number, maxHeight: number, initialSize: number, minSize: number): { fontSize: number, lines: string[] } => {
        let fontSize = initialSize;
        let lines: string[] = [];
        
        while (fontSize >= minSize) {
            lines = wrapText(text, font, fontSize, maxWidth);
            const height = lines.length * (fontSize * LINE_HEIGHT_MULTIPLIER);
            if (height <= maxHeight) {
                return { fontSize, lines };
            }
            fontSize -= 0.5;
        }
        
        // Fallback to min size even if it overflows (should be rare with minSize=5)
        return { fontSize: minSize, lines: wrapText(text, font, minSize, maxWidth) };
    };

    for (const card of flashcards) {
        if (cardCounter % CARDS_PER_PAGE === 0) {
            page = doc.addPage();
            drawBranding(page, fontBold); // Branding
        }
        
        if (!page) continue;

        const { width: pageWidth, height: pageHeight } = page.getSize();
        const cardWidth = (pageWidth - 2 * MARGIN - (COLUMNS - 1) * GUTTER) / COLUMNS;
        const cardHeight = (pageHeight - 2 * MARGIN - (ROWS - 1) * GUTTER) / ROWS;

        const cardIndexOnPage = cardCounter % CARDS_PER_PAGE;
        const row = Math.floor(cardIndexOnPage / COLUMNS);
        const col = cardIndexOnPage % COLUMNS;

        const cardX = MARGIN + col * (cardWidth + GUTTER);
        const cardY = pageHeight - MARGIN - cardHeight - row * (cardHeight + GUTTER);
        
        page.drawRectangle({
            x: cardX,
            y: cardY,
            width: cardWidth,
            height: cardHeight,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.5,
            borderLineDash: [4, 2],
        });

        const PADDING = 10;
        const contentWidth = cardWidth - 2 * PADDING;
        
        // --- RECTO ---
        // Area for Recto Text
        const rectoHeaderHeight = FONT_SIZES.small + 5;
        const rectoContentMaxHeight = (cardHeight / 2) - PADDING - rectoHeaderHeight - 5; // -5 for margin from divider

        // Draw Header "RECTO"
        let currentY = cardY + cardHeight - PADDING;
        currentY -= FONT_SIZES.small;
        page.drawText('RECTO', {
            x: cardX + PADDING,
            y: currentY,
            font: fontBold,
            size: FONT_SIZES.small,
            color: rgb(0.4, 0.4, 0.4),
        });
        currentY -= 5;

        // Fit Recto Text
        const { fontSize: rectoSize, lines: rectoLines } = calculateFitFontSize(
            card.front, 
            font, 
            contentWidth, 
            rectoContentMaxHeight, 
            FONT_SIZES.body, 
            5 
        );
        
        const rectoLineHeight = rectoSize * LINE_HEIGHT_MULTIPLIER;
        for (const line of rectoLines) {
            currentY -= rectoLineHeight;
            page.drawText(line, {
                x: cardX + PADDING,
                y: currentY,
                font,
                size: rectoSize,
                color: rgb(0.1, 0.1, 0.1),
            });
        }
        
        // --- Separator for folding ---
        page.drawLine({
            start: { x: cardX, y: cardY + cardHeight / 2 },
            end: { x: cardX + cardWidth, y: cardY + cardHeight / 2 },
            thickness: 0.25,
            color: rgb(0.85, 0.85, 0.85),
            dashArray: [2, 2],
        });

        // --- VERSO ---
        const versoHeaderHeight = FONT_SIZES.small + 5;
        const versoContentMaxHeight = (cardHeight / 2) - PADDING - versoHeaderHeight;

        currentY = cardY + cardHeight / 2 - PADDING;
        currentY -= FONT_SIZES.small;
        page.drawText('VERSO', {
            x: cardX + PADDING,
            y: currentY,
            font: fontBold,
            size: FONT_SIZES.small,
            color: rgb(0.4, 0.4, 0.4),
        });
        currentY -= 5;
        
        // Fit Verso Text
        const { fontSize: versoSize, lines: versoLines } = calculateFitFontSize(
            card.back, 
            font, 
            contentWidth, 
            versoContentMaxHeight, 
            FONT_SIZES.body, 
            5 
        );

        const versoLineHeight = versoSize * LINE_HEIGHT_MULTIPLIER;

        for (const line of versoLines) {
            currentY -= versoLineHeight;
            page.drawText(line, {
                x: cardX + PADDING,
                y: currentY,
                font,
                size: versoSize,
                color: rgb(0.1, 0.1, 0.1),
            });
        }

        cardCounter++;
    }
};

const drawQuiz = async (doc: PDFDocument, capsule: CognitiveCapsule) => {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const context: { doc: PDFDocument, page: PDFPage, cursor: { y: number }, fontBold: PDFFont } = {
        doc: doc,
        page: doc.addPage(),
        cursor: { y: 0 },
        fontBold: fontBold
    };
    context.cursor.y = context.page.getHeight() - MARGIN;
    
    drawBranding(context.page, fontBold);

    // --- Page 1: Questions ---
    await drawText(context, `Quiz : ${capsule.title}`, { font: fontBold, fontSize: FONT_SIZES.h2, spaceAfter: 10 });
    await drawText(context, 'Questions - Testez vos connaissances', { font, fontSize: FONT_SIZES.body, spaceAfter: 20 });

    for (const [index, q] of capsule.quiz.entries()) {
        const questionBlockHeight = (1 + q.options.length) * (FONT_SIZES.body * LINE_HEIGHT_MULTIPLIER) + 30;
        if (context.cursor.y - questionBlockHeight < MARGIN) {
            context.page = doc.addPage();
            drawBranding(context.page, fontBold);
            context.cursor.y = context.page.getHeight() - MARGIN;
        }

        const questionText = `${index + 1}. ${q.question}`;
        await drawText(context, questionText, { font: fontBold, fontSize: FONT_SIZES.h3, spaceAfter: 10 });
        for (const option of q.options) {
            await drawText(context, `    - ${option}`, { font, fontSize: FONT_SIZES.body, spaceAfter: 5 });
        }
        context.cursor.y -= 15;
    }

    // --- Page 2: Corrections ---
    context.page = doc.addPage();
    drawBranding(context.page, fontBold);
    context.cursor.y = context.page.getHeight() - MARGIN;

    await drawText(context, `Quiz : ${capsule.title}`, { font: fontBold, fontSize: FONT_SIZES.h2, spaceAfter: 10 });
    await drawText(context, 'Corrections', { font, fontSize: FONT_SIZES.body, spaceAfter: 20 });

    for (const [index, q] of capsule.quiz.entries()) {
        const explanationLines = wrapText(q.explanation, font, FONT_SIZES.small, context.page.getSize().width - 2 * MARGIN);
        const correctionBlockHeight = (1 + q.options.length) * (FONT_SIZES.body * LINE_HEIGHT_MULTIPLIER) + (explanationLines.length * FONT_SIZES.small * LINE_HEIGHT_MULTIPLIER) + 30;
        if (context.cursor.y - correctionBlockHeight < MARGIN) {
            context.page = doc.addPage();
            drawBranding(context.page, fontBold);
            context.cursor.y = context.page.getHeight() - MARGIN;
        }

        const questionText = `${index + 1}. ${q.question}`;
        await drawText(context, questionText, { font: fontBold, fontSize: FONT_SIZES.h3, spaceAfter: 10 });
        
        for (const option of q.options) {
            const isCorrect = option === q.correctAnswer;
            await drawText(context, `    - ${option}`, { font: isCorrect ? fontBold : font, fontSize: FONT_SIZES.body, spaceAfter: 5 });
        }
        await drawText(context, `Explication : ${q.explanation}`, { font, fontSize: FONT_SIZES.small, spaceAfter: 5 });
        context.cursor.y -= 15;
    }
};


// --- EXPORTED FUNCTIONS ---

export const downloadCapsulePdf = async (capsule: CognitiveCapsule): Promise<void> => {
    try {
        const doc = await PDFDocument.create();
        await drawCapsuleContent(doc, capsule);
        
        const pdfBytes = await doc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const filename = generateFilename('Capsule', capsule.title || 'sans-titre', 'pdf');
        downloadBlob(blob, filename);
    } catch (error) {
        console.error("PDF generation failed for capsule:", error);
        throw new Error("La génération du PDF a échoué.");
    }
};

export const downloadFlashcardsPdf = async (capsule: CognitiveCapsule): Promise<void> => {
    try {
        const flashcards = capsule.flashcards;
        if (!flashcards || flashcards.length === 0) {
            throw new Error("Cette capsule ne contient pas de flashcards à exporter.");
        }

        const doc = await PDFDocument.create();
        await drawFlashcards(doc, flashcards);
        
        const pdfBytes = await doc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const filename = generateFilename('Flashcards', capsule.title || 'sans-titre', 'pdf');
        downloadBlob(blob, filename);
    } catch (error) {
        console.error("PDF generation failed for flashcards:", error);
        if (error instanceof Error) {
            throw error; // Re-throw the original error to be caught by the UI
        }
        throw new Error("La génération du PDF des flashcards a échoué.");
    }
};

export const downloadQuizPdf = async (capsule: CognitiveCapsule): Promise<void> => {
    try {
        if (!capsule.quiz || capsule.quiz.length === 0) {
            throw new Error("Cette capsule ne contient pas de quiz à exporter.");
        }
        const doc = await PDFDocument.create();
        await drawQuiz(doc, capsule);
        
        const pdfBytes = await doc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const filename = generateFilename('Quiz', capsule.title || 'sans-titre', 'pdf');
        downloadBlob(blob, filename);
    } catch (error) {
        console.error("PDF generation failed for quiz:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("La génération du PDF du quiz a échoué.");
    }
};
