import { Text, View } from 'react-native';
import { useColors } from '../../theme/useColors';
import { resolveExerciseMetadata, type ExerciseMetadataInput } from '../../utils/exerciseCatalog';
import { displayLabel } from '../../utils/displayLabels';

export default function ExerciseMuscleTags({exercise}:{exercise:ExerciseMetadataInput}) {
  const C=useColors();const metadata=resolveExerciseMetadata(exercise);
  const targets=metadata.kind==='mobility'?metadata.mobilityTargets:metadata.primaryMuscles;
  if(!targets.length)return null;
  return <View accessibilityLabel={`${metadata.kind==='mobility'?'Mobility targets':'Primary muscles'}: ${targets.map(displayLabel).join(', ')}`}
    style={{flexDirection:'row',flexWrap:'wrap',gap:6,paddingVertical:6,minWidth:0}}>
    {targets.map(muscle=><Text key={muscle} style={{color:C.textMuted,fontSize:12,paddingHorizontal:8,paddingVertical:4,borderRadius:8,backgroundColor:C.cardAlt,flexShrink:1}}>{displayLabel(muscle)}</Text>)}
  </View>;
}
