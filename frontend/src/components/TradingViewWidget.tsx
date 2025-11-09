'use client';

import { useEffect, useRef } from 'react';

type TradingViewWidgetProps = {
  symbol: string;
  theme?: 'light' | 'dark';
  height?: number;
};

export function TradingViewWidget({
  symbol,
  theme = 'dark',
  height = 320,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    containerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      locale: 'en',
      dateRange: '1D',
      colorTheme: theme,
      isTransparent: false,
      autosize: true,
      height,
      width: '100%',
      chartOnly: false,
      noTimeScale: false,
    });

    containerRef.current.appendChild(script);
  }, [symbol, theme, height]);

  return (
    <div className="tradingview-widget-container h-full w-full" ref={containerRef}>
      <div className="tradingview-widget-container__widget" />
    </div>
  );
}
