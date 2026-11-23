import { useEffect, useState } from 'react';
import { Text,TextInput,TouchableOpacity,View } from 'react-native';
import { useColors } from '../../theme/useColors';
import type { RouteSection } from '../../types/route';
import { routeSectionTarget } from '../../utils/routeSections';

function NumberField({label,value,onChange,factor=1,pace=false,optional=false}: {label:string;value:number|undefined;onChange:(v:number|undefined)=>void;factor?:number;pace?:boolean;optional?:boolean}) {
  const C=useColors();
  const format=(n:number|undefined)=>n===undefined||!Number.isFinite(n)?'':pace?`${Math.floor(n*factor/60)}:${String(Math.round(n*factor)%60).padStart(2,'0')}`:String(Math.round(n*factor*1000)/1000);
  const parse=(text:string):number|undefined=>!text.trim()?(optional?undefined:NaN):pace?(/^\d{1,2}:\d{2}$/.test(text)&&Number(text.split(':')[1])<60?(Number(text.split(':')[0])*60+Number(text.split(':')[1]))/factor:NaN):Number(text)/factor;
  const [text,setText]=useState(()=>format(value));
  useEffect(()=>{ if(!Object.is(parse(text),value)) setText(format(value)); },[value,factor]);
  return <View style={{flex:1,minWidth:105,gap:4}}><Text style={{color:C.textMuted,fontSize:12}}>{label}</Text>
    <TextInput accessibilityLabel={label} value={text} onChangeText={next=>{setText(next);onChange(parse(next));}}
      keyboardType={pace?'numbers-and-punctuation':'decimal-pad'} placeholder={optional?'Optional':'0'} placeholderTextColor={C.textDim}
      style={{color:C.text,backgroundColor:C.cardAlt,borderColor:C.border,borderWidth:1,borderRadius:10,padding:10,minHeight:44}}/>
  </View>;
}
export default function RouteSectionsEditor({sections,onChange,lengthMeters,imperial,needsReview,onReview,error}: {
  sections:RouteSection[];onChange:(sections:RouteSection[])=>void;lengthMeters:number;imperial:boolean;needsReview:boolean;onReview:()=>void;error:string|null;
}) {
  const C=useColors(),factor=1/(imperial?1609.344:1000),unit=imperial?'mi':'km';
  const patch=(id:string,value:Partial<RouteSection>)=>onChange(sections.map(s=>s.id===id?{...s,...value}:s));
  return <View style={{gap:12,paddingVertical:12}}>
    <Text style={{color:C.text,fontSize:18,fontWeight:'800'}}>Route segments</Text>
    <Text style={{color:C.textMuted,fontSize:13}}>Name sections of this mapped route. Start and end are distances from the route start; gaps are allowed. Targets are optional guides.</Text>
    {sections.map((section,index)=><View key={section.id} style={{gap:10,padding:12,borderWidth:1,borderColor:C.border,borderRadius:12}}>
      <Text style={{color:C.primary,fontWeight:'700'}}>Segment {index+1} · {Number.isFinite(section.endMeters-section.startMeters)?((section.endMeters-section.startMeters)*factor).toFixed(2):'—'} {unit}</Text>
      <TextInput value={section.name} onChangeText={name=>patch(section.id,{name})} accessibilityLabel={`Segment ${index+1} name`} placeholder="Hill climb, steady section…" placeholderTextColor={C.textDim} style={{color:C.text,padding:10,borderWidth:1,borderColor:C.border,borderRadius:10,minHeight:44}}/>
      <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>
        <NumberField label={`Start (${unit})`} value={section.startMeters} factor={factor} onChange={startMeters=>patch(section.id,{startMeters:startMeters??NaN})}/>
        <NumberField label={`End (${unit})`} value={section.endMeters} factor={factor} onChange={endMeters=>patch(section.id,{endMeters:endMeters??NaN})}/>
      </View>
      <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>
        <NumberField label={`Pace (min:sec/${unit})`} value={section.targetPaceSecPerMile} factor={imperial?1:1/1.609344} pace optional onChange={targetPaceSecPerMile=>patch(section.id,{targetPaceSecPerMile})}/>
        <NumberField label="Heart-rate zone (1–5)" value={section.targetHrZone} optional onChange={targetHrZone=>patch(section.id,{targetHrZone:targetHrZone as RouteSection['targetHrZone']})}/>
        <NumberField label="Effort / RPE (1–10)" value={section.targetRpe} optional onChange={targetRpe=>patch(section.id,{targetRpe})}/>
      </View>
      {!!routeSectionTarget(section,imperial)&&<Text style={{color:C.textMuted,fontSize:12}}>{routeSectionTarget(section,imperial)}</Text>}
      <TouchableOpacity onPress={()=>onChange(sections.filter(s=>s.id!==section.id))} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:C.critical}}>Remove segment</Text></TouchableOpacity>
    </View>)}
    <TouchableOpacity disabled={lengthMeters<=0} onPress={()=>{
      const start=sections.reduce((n,s)=>Math.max(n,Number.isFinite(s.endMeters)?s.endMeters:0),0);
      onChange([...sections,{id:`section-${Date.now()}-${sections.length}`,name:`Segment ${sections.length+1}`,startMeters:Math.min(start,lengthMeters),endMeters:lengthMeters}]);
    }} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:C.primary,fontWeight:'700'}}>+ Add route segment</Text></TouchableOpacity>
    {error?<Text accessibilityRole="alert" style={{color:C.critical}}>{error}</Text>:null}
    {sections.length>0&&needsReview?<View style={{gap:8}}>
      <Text style={{color:C.warning}}>The route changed. Check each segment’s position and targets on the new line.</Text>
      <TouchableOpacity disabled={!!error} onPress={onReview} style={{padding:12,borderColor:C.primary,borderWidth:1,borderRadius:12,minHeight:44}}><Text style={{color:C.primary,fontWeight:'700'}}>I reviewed these segments</Text></TouchableOpacity>
    </View>:null}
  </View>;
}
