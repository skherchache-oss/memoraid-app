import React from 'react';
import { RefreshCwIcon } from '../constants';

interface PullToRefreshIndicatorProps {
    pullDistance: number;
    isRefreshing: boolean;
}

const PULL_THRESHOLD = 80;

const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({ pullDistance, isRefreshing }) => {
    const opacity = Math.min(pullDistance / PULL_THRESHOLD, 1);
    const iconRotation = isRefreshing ? 0 : Math.min(pullDistance * 2.5, 360);
    const isReadyForRefresh = pullDistance >= PULL_THRESHOLD;

    // The wrapper's height grows with the pull, keeping the icon centered in the revealed space.
    return (
        <div 
            className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-0"
            style={{ 
                height: `${pullDistance}px`, 
                opacity: isRefreshing ? 1 : opacity 
            }}
        >
            <div 
                className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-colors duration-200 ${isReadyForRefresh || isRefreshing ? 'bg-blue-600' : 'bg-white dark:bg-zinc-800'}`}
            >
                <RefreshCwIcon 
                    className={`w-6 h-6 transition-colors duration-200 ${isReadyForRefresh || isRefreshing ? 'text-white' : 'text-slate-500 dark:text-zinc-400'} ${isRefreshing ? 'animate-spin' : ''}`}
                    style={{ transform: `rotate(${iconRotation}deg)` }}
                />
            </div>
        </div>
    );
};

export default PullToRefreshIndicator;