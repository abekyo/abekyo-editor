'use client';

import { usePathname } from 'next/navigation';

export function ProgressBar() {
  const pathname = usePathname();
  
  // 各ステップの定義（/generateページを削除したため更新）
  const steps = [
    { path: '/', progress: 0 },
    { path: '/product-confirm', progress: 33 },
    { path: '/preview', progress: 66 },
    { path: '/video-result', progress: 100 },
  ];
  
  // 現在のパスに基づいて進捗を計算
  const getProgress = () => {
    // 完全一致を優先
    const exactMatch = steps.find(step => step.path === pathname);
    if (exactMatch) {
      return exactMatch.progress;
    }
    
    // 部分一致
    if (pathname?.startsWith('/preview')) {
      return 66;
    }
    if (pathname?.startsWith('/video-result')) {
      return 100;
    }
    if (pathname?.startsWith('/product-confirm')) {
      return 33;
    }
    
    // デフォルト（ホームページ）
    return 0;
  };
  
  const progress = getProgress();
  
  // ホームページの場合はプログレスバーを非表示
  if (pathname === '/') {
    return null;
  }
  
  return (
    <div className="fixed top-12 left-0 right-0 z-50 h-1 bg-[rgba(255,255,255,0.05)]">
      <div 
        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

