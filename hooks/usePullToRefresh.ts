import { useState, useEffect, useCallback, useRef } from 'react';

const PULL_THRESHOLD = 80; // pixels to pull before refresh triggers
const PULL_RESISTANCE = 0.5; // makes pulling feel heavier

export const usePullToRefresh = (onRefresh: () => void) => {
    const [state, setState] = useState({
        pullDistance: 0,
        isRefreshing: false
    });
    const touchStartY = useRef(0);
    const isPulling = useRef(false);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (window.scrollY === 0 && e.touches.length === 1) {
            isPulling.current = true;
            touchStartY.current = e.touches[0].clientY;
            setState(s => ({ ...s, pullDistance: 0 })); // Reset distance on new pull
        }
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isPulling.current) return;

        const currentY = e.touches[0].clientY;
        const distance = Math.max(0, (currentY - touchStartY.current));
        
        // Prevent native overscroll behavior on iOS/Android
        if (distance > 0 && window.scrollY === 0) {
            e.preventDefault();
        }

        setState(s => ({ ...s, pullDistance: distance * PULL_RESISTANCE }));
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!isPulling.current) return;
        isPulling.current = false;

        if (state.pullDistance > PULL_THRESHOLD) {
            setState({ pullDistance: PULL_THRESHOLD, isRefreshing: true });
            // Delay refresh to show animation
            setTimeout(onRefresh, 500);
        } else {
            // Animate back
            setState({ pullDistance: 0, isRefreshing: false });
        }
    }, [onRefresh, state.pullDistance]);

    useEffect(() => {
        // passive: false is needed to call preventDefault()
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return state;
};