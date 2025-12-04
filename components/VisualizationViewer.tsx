
import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { VisualizationData, MindMapNode } from '../types';
import { DownloadIcon, Trash2Icon, RefreshCwIcon } from '../constants';
import html2canvas from 'html2canvas';

interface VisualizationViewerProps {
    data: VisualizationData;
    onUpdate: (newData: VisualizationData) => void;
    onDelete: () => void;
}

// Helper to calculate position based on angle and radius
const getCoordinates = (angle: number, radius: number) => {
    return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
    };
};

// --- RADIAL MIND MAP COMPONENT ---

const RadialMindMap: React.FC<{ data: MindMapNode }> = ({ data }) => {
    const centerX = 400; // Center of the canvas (SVG width / 2)
    const centerY = 300; // Center of the canvas (SVG height / 2)
    
    // Config
    const L1_RADIUS = 160; // Distance for main branches
    const L2_RADIUS = 260; // Distance for sub-branches
    
    // We flatten the tree to render it easily
    const nodes: { id: string, label: string, x: number, y: number, level: number, color: string }[] = [];
    const links: { x1: number, y1: number, x2: number, y2: number, color: string }[] = [];

    // Root
    nodes.push({ id: data.id, label: data.label, x: centerX, y: centerY, level: 0, color: 'bg-emerald-600 text-white border-emerald-600' });

    if (data.children) {
        const totalL1 = data.children.length;
        
        data.children.forEach((child, i) => {
            // Distribute L1 nodes in a full circle
            const angle = (i / totalL1) * 2 * Math.PI;
            const { x, y } = getCoordinates(angle, L1_RADIUS);
            const absX = centerX + x;
            const absY = centerY + y;
            
            const color = ['border-blue-500 text-blue-800 bg-white', 'border-amber-500 text-amber-800 bg-white', 'border-purple-500 text-purple-800 bg-white'][i % 3];
            const linkColor = ['#3b82f6', '#f59e0b', '#a855f7'][i % 3];

            nodes.push({ id: child.id, label: child.label, x: absX, y: absY, level: 1, color });
            links.push({ x1: centerX, y1: centerY, x2: absX, y2: absY, color: linkColor });

            // L2 Nodes (Fan out from parent)
            if (child.children) {
                const totalL2 = child.children.length;
                const fanAngle = Math.PI / 2; // 90 degrees spread
                const startAngle = angle - fanAngle / 2;
                
                child.children.forEach((grandChild, j) => {
                    const subAngle = startAngle + (j / Math.max(1, totalL1 > 4 ? totalL2 : totalL2 - 1)) * fanAngle;
                    const { x: subX, y: subY } = getCoordinates(subAngle, L2_RADIUS); // From CENTER relative logic, but we need relative to parent for visual consistency or projected from center
                    
                    // Simple projection from center for cleaner radial look
                    // Just push them further out at slightly tweaked angles
                    const l2AbsX = centerX + Math.cos(subAngle) * L2_RADIUS;
                    const l2AbsY = centerY + Math.sin(subAngle) * L2_RADIUS;

                    nodes.push({ id: grandChild.id, label: grandChild.label, x: l2AbsX, y: l2AbsY, level: 2, color: 'border-slate-300 text-slate-600 bg-white text-xs' });
                    links.push({ x1: absX, y1: absY, x2: l2AbsX, y2: l2AbsY, color: '#cbd5e1' });
                });
            }
        });
    }

    return (
        <div className="relative w-[800px] h-[600px] bg-slate-50 dark:bg-zinc-900 mx-auto overflow-hidden rounded-xl">
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {links.map((link, i) => (
                    <path 
                        key={i}
                        d={`M ${link.x1} ${link.y1} Q ${(link.x1 + link.x2)/2} ${(link.y1 + link.y2)/2} ${link.x2} ${link.y2}`}
                        fill="none"
                        stroke={link.color}
                        strokeWidth={link.x1 === centerX ? 2.5 : 1.5}
                        strokeOpacity="0.6"
                    />
                ))}
            </svg>
            {nodes.map(node => (
                <div
                    key={node.id}
                    className={`absolute flex items-center justify-center text-center px-3 py-2 rounded-xl border-2 shadow-sm transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 z-10 ${node.color} ${node.level === 0 ? 'text-lg font-bold p-4 z-20 shadow-lg' : 'font-semibold'}`}
                    style={{ left: node.x, top: node.y, maxWidth: '120px' }}
                >
                    {node.label}
                </div>
            ))}
        </div>
    );
};

// --- MAIN COMPONENT ---

const VisualizationViewer: React.FC<VisualizationViewerProps> = ({ data, onUpdate, onDelete }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!contentRef.current) return;
        setIsDownloading(true);
        try {
            const clone = contentRef.current.cloneNode(true) as HTMLElement;
            // Force A4-ish layout props for the clone
            clone.style.width = '800px';
            clone.style.height = '600px';
            clone.style.transform = 'none';
            clone.style.position = 'fixed';
            clone.style.top = '-9999px';
            document.body.appendChild(clone);

            const canvas = await html2canvas(clone, { scale: 2, backgroundColor: null });
            document.body.removeChild(clone);
            
            const link = document.createElement('a');
            link.href = canvas.toDataURL("image/png");
            link.download = `Memoraid_MindMap_${Date.now()}.png`;
            link.click();
        } catch (e) {
            alert("Erreur export image");
        } finally {
            setIsDownloading(false);
        }
    };

    if (data.type !== 'mindmap') return null;

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
                <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wide">
                    Carte Mentale (Mind Map)
                </h4>
                <div className="flex items-center gap-2">
                    <button onClick={handleDownload} disabled={isDownloading} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <DownloadIcon className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                    </button>
                    <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2Icon className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            {/* Scroll container for mobile viewing */}
            <div className="overflow-auto p-4 flex justify-center">
                <div ref={contentRef} className="bg-white dark:bg-zinc-900 inline-block p-4 rounded-xl">
                    <RadialMindMap data={data.data as MindMapNode} />
                </div>
            </div>
        </div>
    );
};

export default VisualizationViewer;
