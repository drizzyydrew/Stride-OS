import { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../theme/useColors';
import TermDefinitionModal from './TermDefinitionModal';

type Props = {
  term: string;
  size?: number;
};

// Small circled "i" that opens the shared term-definition modal. Drop next to
// any workout-type label or training-concept label in the UI.
export default function InfoButton({ term, size = 16 }: Props) {
  const C = useColors();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`About ${term}`}
      >
        <Ionicons name="information-circle-outline" size={size} color={C.textDim} />
      </TouchableOpacity>
      <TermDefinitionModal visible={open} term={term} onClose={() => setOpen(false)} />
    </>
  );
}
