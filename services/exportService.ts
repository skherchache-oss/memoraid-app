
import pptxgen from 'pptxgenjs';
import JSZip from 'jszip';
import type { CognitiveCapsule } from '../types';
import { generateFilename, downloadBlob } from './pdfService';

// Helper pour nettoyer le texte (empêche les erreurs XML dans le PPTX)
const sanitizeForPPTX = (text: string) => {
    if (!text) return "";
    // Supprime les caractères de contrôle XML invalides et normalise
    return String(text).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
};

// --- POWERPOINT GENERATION ---

export const exportToPPTX = async (capsule: CognitiveCapsule) => {
    console.log("PPTX: Début du processus...");
    try {
        // 0. FIX DEPENDENCIES GLOBALS (Sécurité pour PptxGenJS)
        if (typeof window !== 'undefined') {
            if (!(window as any).JSZip) {
                (window as any).JSZip = JSZip;
            }
        }

        // 1. INSTANCIATION
        let PresClass: any = pptxgen;
        
        // Gestion des exports ES Module vs CommonJS
        if (PresClass && typeof PresClass !== 'function') {
            if (PresClass.default) {
                PresClass = PresClass.default;
            } else if ((window as any).PptxGenJS) {
                PresClass = (window as any).PptxGenJS;
            }
        }

        if (typeof PresClass !== 'function') {
            throw new Error("Impossible d'initialiser la librairie PowerPoint.");
        }

        // @ts-ignore
        const pres = new PresClass();

        // 2. CONFIGURATION & THEME
        pres.layout = 'LAYOUT_16x9';
        pres.title = sanitizeForPPTX(capsule.title);
        pres.author = 'Memoraid App';
        pres.company = 'Memoraid Education';

        // Couleurs Charte (Emerald / Amber / Slate) avec hash pour compatibilité web
        const C_PRIMARY = '#059669'; // Emerald 600
        const C_ACCENT = '#D97706';  // Amber 600
        const C_DARK = '#1E293B';    // Slate 800
        const C_LIGHT = '#F8FAFC';   // Slate 50
        const C_WHITE = '#FFFFFF';

        // Définition du Masque (Master Slide)
        pres.defineSlideMaster({
            title: 'MASTER_SLIDE',
            background: { color: C_LIGHT },
            objects: [
                { rect: { x: 0, y: 0, w: 0.3, h: '100%', fill: { color: C_PRIMARY } } },
                { text: { text: 'MEMORAID', options: { x: '90%', y: '92%', fontSize: 10, color: C_PRIMARY, bold: true, align: 'right' } } },
                { text: { text: { type: 'number' }, options: { x: '95%', y: '92%', fontSize: 10, color: C_DARK, align: 'right' } } }
            ]
        });

        // 3. SLIDES
        
        // -- TITRE --
        const slideTitle = pres.addSlide();
        slideTitle.addShape('rect', { x: 0, y: 0, w: '100%', h: '35%', fill: { color: C_PRIMARY } });
        slideTitle.addText(sanitizeForPPTX(capsule.title), {
            x: 0.5, y: 1.5, w: 9, h: 1.5,
            fontSize: 44, bold: true, align: 'left', color: C_WHITE,
            shadow: { type: 'outer', color: '#000000', opacity: 0.3, offset: 2 }
        });
        slideTitle.addText(sanitizeForPPTX(capsule.summary), {
            x: 0.5, y: 3.2, w: 9, h: 2,
            fontSize: 18, align: 'left', color: C_DARK, italic: true
        });
        slideTitle.addText("Support de Révision", {
            x: 0.5, y: 0.5, fontSize: 14, color: '#A7F3D0', bold: true 
        });

        // -- IMAGE (Secure) --
        if (capsule.memoryAidImage) {
            try {
                const slideImg = pres.addSlide({ masterName: 'MASTER_SLIDE' });
                slideImg.addText("Synthèse Visuelle", {
                    x: 0.8, y: 0.5, fontSize: 24, bold: true, color: C_PRIMARY,
                    underline: { style: 'single', color: C_ACCENT }
                });
                
                slideImg.addShape('rect', { x: 1.4, y: 1.4, w: 7.2, h: 4.2, fill: { color: C_WHITE }, line: { color: C_DARK, width: 1 } });
                
                const base64Data = capsule.memoryAidImage.split(',')[1] || capsule.memoryAidImage;
                
                if (base64Data && base64Data.length > 50) {
                    slideImg.addImage({ 
                        data: `data:image/png;base64,${base64Data}`, 
                        x: 1.5, y: 1.5, w: 7, h: 4,
                        sizing: { type: 'contain', w: 7, h: 4 }
                    });
                }

                if (capsule.memoryAidDescription) {
                    slideImg.addText(sanitizeForPPTX(capsule.memoryAidDescription), {
                        x: 1.5, y: 5.8, w: 7, h: 1,
                        fontSize: 12, italic: true, color: '#666666', align: 'center'
                    });
                }
            } catch (err) {
                console.warn("PPTX: Erreur ajout image (ignorée):", err);
            }
        }

        // -- CONCEPTS --
        capsule.keyConcepts.forEach((kc, index) => {
            const slide = pres.addSlide({ masterName: 'MASTER_SLIDE' });
            
            slide.addShape('rect', { x: 0.5, y: 0.5, w: 9, h: 0.8, fill: { color: '#F1F5F9' }, line: { color: C_PRIMARY, width: 0 } });
            slide.addText(`Concept ${index + 1}`, { x: 0.7, y: 0.6, fontSize: 12, color: C_ACCENT, bold: true });
            slide.addText(sanitizeForPPTX(kc.concept), { x: 0.7, y: 0.8, w: 8, fontSize: 24, color: C_DARK, bold: true });

            slide.addShape('rect', { x: 0.8, y: 1.8, w: 8.4, h: 3.5, fill: { color: C_WHITE }, shadow: { type: 'outer', opacity: 0.1 } });
            slide.addText(sanitizeForPPTX(kc.explanation), {
                x: 1.2, y: 2.2, w: 7.6, h: 3,
                fontSize: 20, color: '#334155', valign: 'top',
                bullet: { type: 'number', color: C_PRIMARY }
            });
        });

        // -- EXEMPLES --
        if (capsule.examples.length > 0) {
            const exSlide = pres.addSlide({ masterName: 'MASTER_SLIDE' });
            exSlide.addText("Exemples Pratiques", {
                x: 0.8, y: 0.5, fontSize: 28, bold: true, color: C_PRIMARY
            });

            capsule.examples.forEach((ex, i) => {
                const yPos = 1.5 + (i * 1.2);
                if (yPos < 6) {
                    exSlide.addShape('rect', { x: 1, y: yPos, w: 8, h: 1, fill: { color: '#E0F2FE' } });
                    exSlide.addText(sanitizeForPPTX(ex), {
                        x: 1.2, y: yPos, w: 7.6, h: 1,
                        fontSize: 16, color: '#0369A1', valign: 'middle'
                    });
                }
            });
        }

        // -- QUIZ --
        if (capsule.quiz.length > 0) {
            const quizIntroSlide = pres.addSlide({ masterName: 'MASTER_SLIDE' });
            quizIntroSlide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C_ACCENT } });
            quizIntroSlide.addText("QUIZ DE VALIDATION", {
                x: 0, y: '45%', w: '100%',
                fontSize: 48, bold: true, align: 'center', color: C_WHITE
            });

            capsule.quiz.forEach((q, i) => {
                const slideQ = pres.addSlide({ masterName: 'MASTER_SLIDE' });
                slideQ.addText(`Question ${i + 1}`, { x: 0.8, y: 0.5, fontSize: 18, color: C_ACCENT, bold: true });
                slideQ.addText(sanitizeForPPTX(q.question), { x: 0.8, y: 1.2, w: 8.5, fontSize: 24, bold: true, color: C_DARK });

                q.options.forEach((opt, idx) => {
                    const yOpt = 2.5 + (idx * 0.8);
                    slideQ.addShape('rect', { x: 1.5, y: yOpt, w: 7, h: 0.6, fill: { color: '#F8FAFC' }, line: { color: '#CBD5E1' } });
                    slideQ.addText(sanitizeForPPTX(opt), { x: 1.7, y: yOpt, w: 6.5, h: 0.6, fontSize: 14, color: '#475569', valign: 'middle' });
                });

                slideQ.addShape('rect', { x: 0.8, y: 6, w: 8.4, h: 1, fill: { color: '#ECFDF5' }, line: { color: C_PRIMARY } });
                slideQ.addText(`Réponse correcte : ${sanitizeForPPTX(q.correctAnswer)}`, { x: 1, y: 6.1, w: 8, fontSize: 14, bold: true, color: '#065F46' });
                slideQ.addText(sanitizeForPPTX(q.explanation), { x: 1, y: 6.5, w: 8, fontSize: 12, italic: true, color: '#064E3B' });
            });
        }

        console.log("PPTX: Sauvegarde...");
        
        // 4. GENERATE FILE (Utilisation de la méthode native writeFile)
        const safeTitle = capsule.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        await pres.writeFile({ fileName: `Memoraid_${safeTitle}.pptx` });
        
        console.log("Fichier PPTX sauvegardé.");

    } catch (e: any) {
        console.error("PPTX Generation Error Full:", e);
        throw new Error(`Erreur PowerPoint: ${e.message || 'Inconnue'}`);
    }
};

// ... exportToEPUB inchangé ...
export const exportToEPUB = async (capsule: CognitiveCapsule) => {
    try {
        const zip = new JSZip();
        zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
        zip.folder("META-INF")?.file("container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
        const oebps = zip.folder("OEBPS");
        if (!oebps) throw new Error("Zip error");

        const conceptsHtml = capsule.keyConcepts.map(c => `
            <div class="concept">
                <h2>${c.concept}</h2>
                <p>${c.explanation}</p>
            </div>
        `).join('');

        const examplesHtml = capsule.examples.length > 0 ? `
            <div class="section">
                <h2>Exemples</h2>
                <ul>${capsule.examples.map(e => `<li>${e}</li>`).join('')}</ul>
            </div>
        ` : '';

        const quizHtml = capsule.quiz.length > 0 ? `
            <div class="section">
                <h2>Quiz</h2>
                ${capsule.quiz.map((q, i) => `
                    <div class="question">
                        <p><strong>Q${i + 1}:</strong> ${q.question}</p>
                        <p class="answer"><em>Réponse : ${q.correctAnswer}</em></p>
                        <p class="explanation">${q.explanation}</p>
                    </div>
                `).join('')}
            </div>
        ` : '';

        const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr">
<head>
    <title>${capsule.title}</title>
    <style>body { font-family: sans-serif; line-height: 1.5; } h1 { color: #2c3e50; text-align: center; } h2 { color: #3498db; border-bottom: 1px solid #eee; padding-bottom: 5px; } .summary { font-style: italic; background: #f9f9f9; padding: 15px; border-radius: 5px; } .concept { margin-bottom: 20px; } .question { margin-bottom: 15px; border-left: 3px solid #e67e22; padding-left: 10px; } .answer { color: #27ae60; }</style>
</head>
<body>
    <h1>${capsule.title}</h1>
    <div class="summary"><p>${capsule.summary}</p></div>
    ${conceptsHtml}
    ${examplesHtml}
    ${quizHtml}
    <p style="text-align:center; font-size:0.8em; color:#999; margin-top:50px;">Généré par Memoraid</p>
</body>
</html>`;

        oebps.file("capsule.xhtml", xhtmlContent);

        const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>${capsule.title}</dc:title>
        <dc:creator opf:role="aut">Memoraid</dc:creator>
        <dc:language>fr</dc:language>
        <dc:identifier id="BookID" opf:scheme="UUID">urn:uuid:${capsule.id}</dc:identifier>
    </metadata>
    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="capsule" href="capsule.xhtml" media-type="application/xhtml+xml"/>
    </manifest>
    <spine toc="ncx"><itemref idref="capsule"/></spine>
</package>`;
        oebps.file("content.opf", opfContent);

        const ncxContent = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:${capsule.id}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle><text>${capsule.title}</text></docTitle>
    <navMap><navPoint id="navPoint-1" playOrder="1"><navLabel><text>Capsule</text></navLabel><content src="capsule.xhtml"/></navPoint></navMap>
</ncx>`;
        oebps.file("toc.ncx", ncxContent);

        const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
        const filename = generateFilename('Livre', capsule.title, 'epub');
        downloadBlob(blob, filename);

    } catch (e) {
        console.error("ePub Generation Error", e);
        throw new Error("Erreur lors de la génération ePub.");
    }
};
