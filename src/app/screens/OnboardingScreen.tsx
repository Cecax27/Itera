// Onboarding del perfil.
//
// Flujo: 8 pasos lineales. Navegación con Siguiente / Atrás. Al confirmar,
// se persiste con useProfile.save() y se vuelve a la pantalla anterior.
// Si el usuario cierra la app a mitad, vuelve a empezar (no guardamos
// progreso parcial).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Screen as ScreenLayout, TextField } from '@/app/components';
import { FadeIn } from '@/app/animations';
import {
  ALL_EQUIPMENT,
  ALL_WEEK_DAYS,
  ExperienceLevel,
  Goal,
  Profile,
  emptyAvailability,
  emptyEquipment,
  emptyRestrictions,
} from '@/domain/profile';
import { useThemeTokens } from '@/app/theme';

type Step =
  | 'welcome'
  | 'basics'
  | 'goal'
  | 'secondary'
  | 'availability'
  | 'equipment'
  | 'restrictions'
  | 'summary';

const STEPS: readonly Step[] = [
  'welcome',
  'basics',
  'goal',
  'secondary',
  'availability',
  'equipment',
  'restrictions',
  'summary',
];

export interface OnboardingScreenProps {
  onComplete: (profile: Profile) => Promise<void> | void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [primaryGoal, setPrimaryGoal] = useState<Goal>({
    id: 'primary',
    description: '',
    discipline: 'running',
    target: '',
  });
  const [secondaryGoals, setSecondaryGoals] = useState<Goal[]>([]);
  const [availability, setAvailability] = useState(emptyAvailability());
  const [equipment, setEquipment] = useState(emptyEquipment());
  const [restrictions, setRestrictions] = useState(emptyRestrictions());
  const [saving, setSaving] = useState(false);

  const profile: Profile = {
    name: name.trim() || undefined,
    age: age ? Number(age) : undefined,
    experience,
    primaryGoal,
    secondaryGoals,
    availability,
    equipment,
    restrictions,
  };

  const onNext = () => setStep(nextStep(step));
  const onBack = () => setStep(prevStep(step));

  const onConfirm = async () => {
    setSaving(true);
    try {
      await onComplete(profile);
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <ScreenLayout scroll>
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              i <= stepIndex && { backgroundColor: tokens.colors.accent },
            ]}
          />
        ))}
      </View>

      <Text style={styles.stepLabel}>{labelFor(step)}</Text>

      <FadeIn delay={0} key={step}>
        {step === 'welcome' && <WelcomeStep />}
        {step === 'basics' && (
          <BasicsStep
            name={name}
            setName={setName}
            age={age}
            setAge={setAge}
            experience={experience}
            setExperience={setExperience}
          />
        )}
        {step === 'goal' && <PrimaryGoalStep goal={primaryGoal} setGoal={setPrimaryGoal} />}
        {step === 'secondary' && (
          <SecondaryGoalsStep goals={secondaryGoals} setGoals={setSecondaryGoals} />
        )}
        {step === 'availability' && (
          <AvailabilityStep availability={availability} setAvailability={setAvailability} />
        )}
        {step === 'equipment' && (
          <EquipmentStep equipment={equipment} setEquipment={setEquipment} />
        )}
        {step === 'restrictions' && (
          <RestrictionsStep restrictions={restrictions} setRestrictions={setRestrictions} />
        )}
        {step === 'summary' && <SummaryStep profile={profile} />}
      </FadeIn>

      <View style={styles.buttons}>
        {step !== 'welcome' && (
          <Button label="Atrás" onPress={onBack} variant="secondary" fullWidth={false} />
        )}
        {step !== 'summary' ? (
          <Button label="Siguiente" onPress={onNext} variant="primary" fullWidth={false} />
        ) : (
          <Button
            label={saving ? 'Guardando…' : 'Confirmar'}
            onPress={onConfirm}
            loading={saving}
            variant="primary"
            fullWidth={false}
          />
        )}
      </View>
    </ScreenLayout>
  );
}

function nextStep(s: Step): Step {
  const i = STEPS.indexOf(s);
  return STEPS[Math.min(i + 1, STEPS.length - 1)];
}

function prevStep(s: Step): Step {
  const i = STEPS.indexOf(s);
  return STEPS[Math.max(i - 1, 0)];
}

function labelFor(step: Step): string {
  switch (step) {
    case 'welcome': return 'Bienvenida';
    case 'basics': return 'Sobre ti';
    case 'goal': return 'Objetivo principal';
    case 'secondary': return 'Objetivos secundarios';
    case 'availability': return 'Disponibilidad';
    case 'equipment': return 'Equipamiento';
    case 'restrictions': return 'Restricciones';
    case 'summary': return 'Resumen';
  }
}

// --- Steps -----

function WelcomeStep() {
  const tokens = useThemeTokens();
  return (
    <View>
      <Text style={[welcomeStyles.title, { color: tokens.colors.ink }]}>
        Vamos a configurar tu perfil
      </Text>
      <Text style={[welcomeStyles.body, { color: tokens.colors.textSecondary }]}>
        Te haré unas preguntas rápidas para entender qué quieres conseguir,
        cuándo puedes entrenar y con qué cuentas.
      </Text>
      <Text style={[welcomeStyles.body, { color: tokens.colors.textSecondary }]}>
        Podrás editar todo esto más tarde desde Ajustes.
      </Text>
    </View>
  );
}

const welcomeStyles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 16,
    marginBottom: 12,
    lineHeight: 22,
  },
});

interface BasicsProps {
  name: string;
  setName: (v: string) => void;
  age: string;
  setAge: (v: string) => void;
  experience: ExperienceLevel;
  setExperience: (v: ExperienceLevel) => void;
}

function BasicsStep({ name, setName, age, setAge, experience, setExperience }: BasicsProps) {
  return (
    <View>
      <TextField label="Nombre (opcional)" value={name} onChangeText={setName} placeholder="Cómo te llamas" autoCapitalize="words" />
      <TextField label="Edad (opcional)" value={age} onChangeText={setAge} placeholder="Años" keyboardType="number-pad" />
      <Text style={sectionTitle.text}>Experiencia</Text>
      <View style={chipStyles.row}>
        {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
          <Chip
            key={lvl}
            label={experienceLabel(lvl)}
            selected={experience === lvl}
            onPress={() => setExperience(lvl)}
          />
        ))}
      </View>
    </View>
  );
}

const sectionTitle = StyleSheet.create({
  text: {
    fontSize: 13,
    fontWeight: '500',
    color: '#20231F',
    marginTop: 16,
    marginBottom: 8,
  },
});

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

function experienceLabel(lvl: ExperienceLevel): string {
  switch (lvl) {
    case 'beginner': return 'Principiante';
    case 'intermediate': return 'Intermedio';
    case 'advanced': return 'Avanzado';
  }
}

interface PrimaryGoalProps {
  goal: Goal;
  setGoal: (g: Goal) => void;
}

function PrimaryGoalStep({ goal, setGoal }: PrimaryGoalProps) {
  return (
    <View>
      <Text style={stepText.body}>
        Define un objetivo principal. Es lo primero que la IA intentará ayudarte a conseguir.
      </Text>
      <TextField
        label="Descripción"
        value={goal.description}
        onChangeText={(d) => setGoal({ ...goal, description: d })}
        placeholder="Ej. Bajar 5 km a 22 minutos"
      />
      <Text style={sectionTitle.text}>Disciplina</Text>
      <View style={chipStyles.row}>
        <Chip label="Carrera" selected={goal.discipline === 'running'} onPress={() => setGoal({ ...goal, discipline: 'running' })} />
        <Chip label="Fuerza" selected={goal.discipline === 'strength'} onPress={() => setGoal({ ...goal, discipline: 'strength' })} />
      </View>
      <TextField
        label="Meta concreta"
        value={goal.target}
        onChangeText={(t) => setGoal({ ...goal, target: t })}
        placeholder="Ej. 22:00 en 5 km o 80 kg en press banca"
      />
      <TextField
        label="Fecha objetivo (opcional)"
        value={goal.targetDate ?? ''}
        onChangeText={(d) => setGoal({ ...goal, targetDate: d || undefined })}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
      />
    </View>
  );
}

const stepText = StyleSheet.create({
  body: { fontSize: 16, color: '#20231F', marginBottom: 12, lineHeight: 22 },
});

interface SecondaryGoalsProps {
  goals: Goal[];
  setGoals: (g: Goal[]) => void;
}

function SecondaryGoalsStep({ goals, setGoals }: SecondaryGoalsProps) {
  const tokens = useThemeTokens();
  const add = () => {
    if (goals.length >= 10) return;
    setGoals([
      ...goals,
      { id: `sec-${Date.now()}`, description: '', discipline: 'strength', target: '' },
    ]);
  };
  const update = (i: number, patch: Partial<Goal>) => {
    setGoals(goals.map((g, j) => (i === j ? { ...g, ...patch } : g)));
  };
  const remove = (i: number) => setGoals(goals.filter((_, j) => j !== i));

  return (
    <View>
      <Text style={stepText.body}>
        Objetivos secundarios (opcional). Cosas que te interesan pero que no son la urgencia principal.
      </Text>
      {goals.map((g, i) => (
        <Card key={g.id} padding="md" style={secondaryStyles.itemSpacing}>
          <TextField
            label={`Objetivo ${i + 1}`}
            value={g.description}
            onChangeText={(d) => update(i, { description: d })}
            placeholder="Describe el objetivo"
          />
          <View style={chipStyles.row}>
            <Chip label="Carrera" selected={g.discipline === 'running'} onPress={() => update(i, { discipline: 'running' })} />
            <Chip label="Fuerza" selected={g.discipline === 'strength'} onPress={() => update(i, { discipline: 'strength' })} />
          </View>
          <TextField
            label="Meta"
            value={g.target}
            onChangeText={(t) => update(i, { target: t })}
            placeholder="Meta"
          />
          <Pressable onPress={() => remove(i)}>
            <Text style={[secondaryStyles.remove, { color: tokens.colors.error }]}>
              Quitar este objetivo
            </Text>
          </Pressable>
        </Card>
      ))}
      {goals.length < 10 && (
        <Pressable onPress={add}>
          <Text style={[secondaryStyles.add, { color: tokens.colors.ink }]}>+ Añadir objetivo secundario</Text>
        </Pressable>
      )}
    </View>
  );
}

const secondaryStyles = StyleSheet.create({
  itemSpacing: { marginBottom: 12 },
  add: { fontSize: 14, textDecorationLine: 'underline', marginTop: 4 },
  remove: { fontSize: 13, textDecorationLine: 'underline', marginTop: 4 },
});

interface AvailabilityProps {
  availability: ReturnType<typeof emptyAvailability>;
  setAvailability: (a: ReturnType<typeof emptyAvailability>) => void;
}

function AvailabilityStep({ availability, setAvailability }: AvailabilityProps) {
  const tokens = useThemeTokens();
  return (
    <View>
      <Text style={[stepText.body, { color: tokens.colors.textSecondary }]}>
        Indica las franjas en las que puedes entrenar cada día. Si un día no tienes tiempo, déjalo vacío.
      </Text>
      {ALL_WEEK_DAYS.map((day) => (
        <DayRow
          key={day}
          day={day}
          slots={availability[day]}
          onChange={(slots) => setAvailability({ ...availability, [day]: slots })}
        />
      ))}
    </View>
  );
}

function DayRow({
  day,
  slots,
  onChange,
}: {
  day: typeof ALL_WEEK_DAYS[number];
  slots: ReturnType<typeof emptyAvailability>[typeof ALL_WEEK_DAYS[number]];
  onChange: (slots: ReturnType<typeof emptyAvailability>[typeof ALL_WEEK_DAYS[number]]) => void;
}) {
  const tokens = useThemeTokens();
  const addSlot = () => onChange([...slots, { start: '08:00', end: '09:00' }]);
  const updateSlot = (i: number, patch: Partial<{ start: string; end: string }>) =>
    onChange(slots.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  const removeSlot = (i: number) => onChange(slots.filter((_, j) => j !== i));

  return (
    <Card padding="sm" style={dayRowStyles.card}>
      <Text style={[dayRowStyles.dayLabel, { color: tokens.colors.ink }]}>{dayLabel(day)}</Text>
      {slots.map((slot, i) => (
        <View key={i} style={dayRowStyles.slotRow}>
          <TextField value={slot.start} onChangeText={(t) => updateSlot(i, { start: t })} placeholder="HH:mm" />
          <Text style={[dayRowStyles.slotSep, { color: tokens.colors.textSecondary }]}>a</Text>
          <TextField value={slot.end} onChangeText={(t) => updateSlot(i, { end: t })} placeholder="HH:mm" />
          <Pressable onPress={() => removeSlot(i)} style={dayRowStyles.removeButton}>
            <Text style={[dayRowStyles.removeText, { color: tokens.colors.error }]}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addSlot}>
        <Text style={[dayRowStyles.add, { color: tokens.colors.ink }]}>+ Añadir franja</Text>
      </Pressable>
    </Card>
  );
}

const dayRowStyles = StyleSheet.create({
  card: { marginBottom: 8 },
  dayLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotSep: { fontSize: 14 },
  removeButton: { paddingHorizontal: 4, paddingVertical: 8 },
  removeText: { fontSize: 18 },
  add: { fontSize: 13, textDecorationLine: 'underline', marginTop: 4 },
});

function dayLabel(day: typeof ALL_WEEK_DAYS[number]): string {
  switch (day) {
    case 'mon': return 'Lunes';
    case 'tue': return 'Martes';
    case 'wed': return 'Miércoles';
    case 'thu': return 'Jueves';
    case 'fri': return 'Viernes';
    case 'sat': return 'Sábado';
    case 'sun': return 'Domingo';
  }
}

interface EquipmentProps {
  equipment: ReturnType<typeof emptyEquipment>;
  setEquipment: (e: ReturnType<typeof emptyEquipment>) => void;
}

function EquipmentStep({ equipment, setEquipment }: EquipmentProps) {
  const tokens = useThemeTokens();
  return (
    <View>
      <Text style={[stepText.body, { color: tokens.colors.textSecondary }]}>
        ¿Con qué equipamiento cuentas?
      </Text>
      {ALL_EQUIPMENT.map((id) => (
        <Pressable
          key={id}
          style={[equipmentStyles.row, { borderBottomColor: tokens.colors.border }]}
          onPress={() => setEquipment({ ...equipment, [id]: !equipment[id] })}
        >
          <View
            style={[
              equipmentStyles.checkbox,
              { borderColor: tokens.colors.ink },
              equipment[id] && { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
            ]}
          >
            {equipment[id] && <Text style={[equipmentStyles.checkmark, { color: tokens.colors.accentInk }]}>✓</Text>}
          </View>
          <Text style={[equipmentStyles.label, { color: tokens.colors.ink }]}>
            {equipmentLabel(id)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const equipmentStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 15 },
});

function equipmentLabel(id: typeof ALL_EQUIPMENT[number]): string {
  switch (id) {
    case 'dumbbells': return 'Mancuernas';
    case 'barbell': return 'Barra';
    case 'kettlebell': return 'Kettlebell';
    case 'resistance_bands': return 'Bandas de resistencia';
    case 'pull_up_bar': return 'Barra de dominadas';
    case 'bench': return 'Banco';
    case 'squat_rack': return 'Rack de sentadillas';
    case 'treadmill': return 'Cinta de correr';
    case 'outdoor_running_route': return 'Ruta al aire libre';
    case 'stationary_bike': return 'Bicicleta estática';
  }
}

interface RestrictionsProps {
  restrictions: ReturnType<typeof emptyRestrictions>;
  setRestrictions: (r: ReturnType<typeof emptyRestrictions>) => void;
}

function RestrictionsStep({ restrictions, setRestrictions }: RestrictionsProps) {
  const tokens = useThemeTokens();
  const addInjury = () =>
    setRestrictions({ injuries: [...restrictions.injuries, ''], notes: restrictions.notes });

  return (
    <View>
      <Text style={[stepText.body, { color: tokens.colors.textSecondary }]}>
        ¿Tienes lesiones activas o limitaciones que el plan deba respetar? Si no, pasa al resumen.
      </Text>
      {restrictions.injuries.map((injury, i) => (
        <View key={i} style={restrictionsStyles.slotRow}>
          <TextField
            value={injury}
            onChangeText={(v) =>
              setRestrictions({
                injuries: restrictions.injuries.map((x, j) => (i === j ? v : x)),
                notes: restrictions.notes,
              })
            }
            placeholder="Describe la lesión o limitación"
          />
          <Pressable
            onPress={() =>
              setRestrictions({
                injuries: restrictions.injuries.filter((_, j) => j !== i),
                notes: restrictions.notes,
              })
            }
            style={restrictionsStyles.removeButton}
          >
            <Text style={[restrictionsStyles.removeText, { color: tokens.colors.error }]}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addInjury}>
        <Text style={[restrictionsStyles.add, { color: tokens.colors.ink }]}>+ Añadir lesión</Text>
      </Pressable>

      <TextField
        label="Otras notas"
        value={restrictions.notes}
        onChangeText={(notes) => setRestrictions({ injuries: restrictions.injuries, notes })}
        placeholder="Preferencias, alergias, etc."
        multiline
      />
    </View>
  );
}

const restrictionsStyles = StyleSheet.create({
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeButton: { paddingHorizontal: 4, paddingVertical: 8 },
  removeText: { fontSize: 18 },
  add: { fontSize: 13, textDecorationLine: 'underline', marginTop: 4 },
});

function SummaryStep({ profile }: { profile: Profile }) {
  const tokens = useThemeTokens();
  return (
    <View>
      <Text style={[summaryStyles.title, { color: tokens.colors.ink }]}>Resumen</Text>
      <Text style={[summaryStyles.body, { color: tokens.colors.textSecondary }]}>
        {profile.name ? `${profile.name}, ` : ''}experiencia {experienceLabel(profile.experience)}.
      </Text>
      <Text style={[summaryStyles.body, { color: tokens.colors.textSecondary }]}>
        Objetivo principal: {profile.primaryGoal.description || '(vacío)'}
      </Text>
      <Text style={[summaryStyles.body, { color: tokens.colors.textSecondary }]}>
        {profile.secondaryGoals.length} objetivo(s) secundario(s).
      </Text>
      <Text style={[summaryStyles.body, { color: tokens.colors.textSecondary }]}>
        Dispones de {Object.values(profile.equipment).filter(Boolean).length} piezas de equipamiento.
      </Text>
      {profile.restrictions.injuries.length > 0 && (
        <Text style={[summaryStyles.body, { color: tokens.colors.textSecondary }]}>
          {profile.restrictions.injuries.length} lesión(es) o limitación(es) registrada(s).
        </Text>
      )}
      <Text style={[summaryStyles.body, { color: tokens.colors.textSecondary, marginTop: 12 }]}>
        Toca "Confirmar" para guardar el perfil.
      </Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '600', marginBottom: 16, letterSpacing: -0.3 },
  body: { fontSize: 15, marginBottom: 8, lineHeight: 22 },
});

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    progress: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: tokens.spacing.lg,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: tokens.colors.surface,
    },
    stepLabel: {
      fontSize: tokens.fontSize.caption,
      color: tokens.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: tokens.spacing.md,
    },
    buttons: {
      flexDirection: 'row',
      gap: tokens.spacing.md,
      marginTop: tokens.spacing.xl,
    },
  });
}