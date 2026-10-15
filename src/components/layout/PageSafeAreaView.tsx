import { useMemo } from 'react';
import { SafeAreaView, useSafeAreaInsets, type SafeAreaViewProps } from 'react-native-safe-area-context';
import { useHasFixedNavigationBanner } from './NavigationEscape';

export function usePageSafeAreaInsets() {
  const insets = useSafeAreaInsets();
  const fixed = useHasFixedNavigationBanner();
  return useMemo(() => fixed ? { ...insets, top: 0 } : insets, [insets, fixed]);
}

/** The fixed native header owns the top inset; standalone pages retain it. */
export default function PageSafeAreaView({ edges, ...props }: SafeAreaViewProps) {
  const fixed = useHasFixedNavigationBanner();
  const pageEdges: SafeAreaViewProps['edges'] = !fixed ? edges : Array.isArray(edges)
    ? edges.filter(edge => edge !== 'top')
    : { bottom: 'additive', left: 'additive', right: 'additive', ...edges, top: 'off' };
  return <SafeAreaView {...props} edges={pageEdges} />;
}
