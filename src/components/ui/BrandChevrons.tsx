import Svg, { Path } from 'react-native-svg';
import { useThemeStore } from '../../store/themeStore';

export default function BrandChevrons({ direction = 'left', size = 26 }: {
  direction?: 'left' | 'down';
  size?: number;
}) {
  const dark = useThemeStore(state => state.mode) === 'dark';
  const strokes = dark ? ['#C79C85', '#C79C85'] : ['#765331', '#5E7E92'];
  const paths = direction === 'left'
    ? ['M11 4 L3 12 L11 20', 'M21 4 L13 12 L21 20']
    : ['M4 3 L12 11 L20 3', 'M4 13 L12 21 L20 13'];
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    {paths.map((d, index) => <Path key={d} d={d} fill="none" stroke={strokes[index]} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />)}
  </Svg>;
}
