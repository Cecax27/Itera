// Onboarding del perfil.
//
// Flujo: 7 pasos lineales (bienvenida -> datos -> objetivo principal ->
// objetivos secundarios -> disponibilidad -> equipamiento -> restricciones
// -> resumen). Se navega con Siguiente / Atrás. Al confirmar, se persiste
// con useProfile.save() y se vuelve a la pantalla anterior.
//
// Decisiones:
// - Un solo componente con estado interno. Cuando crezca, lo dividimos.
// - No se puede saltar el onboarding: una vez que empieza, hay que
//   completarlo (botón Atrás no descarta cambios, solo vuelve).
// - Si el usuario cierra la app a mitad, al volver vuelve a empezar (no
//   guardamos progreso parcial; el perfil se guarda solo al confirmar).

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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

type Step = 'welcome' | 'basics' | 'goal' | 'secondary' | 'availability' | 'equipment' | 'restrictions' | 'summary';

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

function nextStep(s: Step): Step {
  const i = STEPS.indexOf(s);
  return STEPS[Math.min(i + 1, STEPS.length - 1)];
}

function prevStep(s: Step): Step {
  const i = STEPS.indexOf(s);
  return STEPS[Math.max(i - 1, 0)];
}

export interface OnboardingScreenProps {
  onComplete: (profile: Profile) => Promise<void> | void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.stepLabel}>{labelFor(step)}</Text>

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
      {step === 'goal' && (
        <PrimaryGoalStep goal={primaryGoal} setGoal={setPrimaryGoal} />
      )}
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

      <View style={styles.buttons}>
        {step !== 'welcome' && (
          <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onBack}>
            <Text style={styles.buttonTextSecondary}>Atrás</Text>
          </Pressable>
        )}
        {step !== 'summary' ? (
          <Pressable style={[styles.button, styles.buttonPrimary]} onPress={onNext}>
            <Text style={styles.buttonTextPrimary}>Siguiente</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, styles.buttonPrimary]}
            onPress={onConfirm}
            disabled={saving}
          >
            <Text style={styles.buttonTextPrimary}>{saving ? 'Guardando…' : 'Confirmar'}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
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
  return (
    <View style={styles.step}>
      <Text style={styles.title}>Vamos a configurar tu perfil</Text>
      <Text style={styles.body}>
        Te haré unas preguntas rápidas para entender qué quieres conseguir,
        cuándo puedes entrenar y con qué cuentas.
      </Text>
      <Text style={styles.body}>
        Podrás editar todo esto más tarde desde Ajustes.
      </Text>
    </View>
  );
}

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
    <View style={styles.step}>
      <Text style={styles.label}>Nombre (opcional)</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Cómo te llamas"
      />

      <Text style={styles.label}>Edad (opcional)</Text>
      <TextInput
        style={styles.input}
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        placeholder="Años"
      />

      <Text style={styles.label}>Experiencia</Text>
      <View style={styles.row}>
        {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
          <Pressable
            key={lvl}
            style={[styles.chip, experience === lvl && styles.chipActive]}
            onPress={() => setExperience(lvl)}
          >
            <Text style={experience === lvl ? styles.chipTextActive : styles.chipText}>
              {experienceLabel(lvl)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

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
    <View style={styles.step}>
      <Text style={styles.body}>
        Define un objetivo principal. Es lo primero que la IA intentará ayudarte a conseguir.
      </Text>

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={styles.input}
        value={goal.description}
        onChangeText={(d) => setGoal({ ...goal, description: d })}
        placeholder="Ej. Bajar 5 km a 22 minutos"
      />

      <Text style={styles.label}>Disciplina</Text>
      <View style={styles.row}>
        {(['running', 'strength'] as const).map((d) => (
          <Pressable
            key={d}
            style={[styles.chip, goal.discipline === d && styles.chipActive]}
            onPress={() => setGoal({ ...goal, discipline: d })}
          >
            <Text style={goal.discipline === d ? styles.chipTextActive : styles.chipText}>
              {d === 'running' ? 'Carrera' : 'Fuerza'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Meta concreta</Text>
      <TextInput
        style={styles.input}
        value={goal.target}
        onChangeText={(t) => setGoal({ ...goal, target: t })}
        placeholder="Ej. 22:00 en 5 km o 80 kg en press banca"
      />

      <Text style={styles.label}>Fecha objetivo (opcional)</Text>
      <TextInput
        style={styles.input}
        value={goal.targetDate ?? ''}
        onChangeText={(d) => setGoal({ ...goal, targetDate: d || undefined })}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
      />
    </View>
  );
}

interface SecondaryGoalsProps {
  goals: Goal[];
  setGoals: (g: Goal[]) => void;
}

function SecondaryGoalsStep({ goals, setGoals }: SecondaryGoalsProps) {
  const add = () => {
    if (goals.length >= 10) return;
    setGoals([
      ...goals,
      {
        id: `sec-${Date.now()}`,
        description: '',
        discipline: 'strength',
        target: '',
      },
    ]);
  };
  const update = (i: number, patch: Partial<Goal>) => {
    setGoals(goals.map((g, j) => (i === j ? { ...g, ...patch } : g)));
  };
  const remove = (i: number) => setGoals(goals.filter((_, j) => j !== i));

  return (
    <View style={styles.step}>
      <Text style={styles.body}>
        Objetivos secundarios (opcional). Cosas que te interesan pero que no son la urgencia principal.
      </Text>

      {goals.map((g, i) => (
        <View key={g.id} style={styles.subItem}>
          <TextInput
            style={styles.input}
            value={g.description}
            onChangeText={(d) => update(i, { description: d })}
            placeholder={`Objetivo ${i + 1}`}
          />
          <View style={styles.row}>
            {(['running', 'strength'] as const).map((d) => (
              <Pressable
                key={d}
                style={[styles.chip, g.discipline === d && styles.chipActive]}
                onPress={() => update(i, { discipline: d })}
              >
                <Text style={g.discipline === d ? styles.chipTextActive : styles.chipText}>
                  {d === 'running' ? 'Carrera' : 'Fuerza'}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={g.target}
            onChangeText={(t) => update(i, { target: t })}
            placeholder="Meta"
          />
          <Pressable onPress={() => remove(i)}>
            <Text style={styles.linkDanger}>Quitar</Text>
          </Pressable>
        </View>
      ))}

      {goals.length < 10 && (
        <Pressable onPress={add}>
          <Text style={styles.link}>+ Añadir objetivo secundario</Text>
        </Pressable>
      )}
    </View>
  );
}

interface AvailabilityProps {
  availability: ReturnType<typeof emptyAvailability>;
  setAvailability: (a: ReturnType<typeof emptyAvailability>) => void;
}

function AvailabilityStep({ availability, setAvailability }: AvailabilityProps) {
  return (
    <View style={styles.step}>
      <Text style={styles.body}>
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
  const addSlot = () =>
    onChange([...slots, { start: '08:00', end: '09:00' }]);
  const updateSlot = (i: number, patch: Partial<{ start: string; end: string }>) =>
    onChange(slots.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  const removeSlot = (i: number) =>
    onChange(slots.filter((_, j) => j !== i));

  return (
    <View style={styles.subItem}>
      <Text style={styles.label}>{dayLabel(day)}</Text>
      {slots.map((slot, i) => (
        <View key={i} style={styles.slotRow}>
          <TextInput
            style={[styles.input, styles.inputTime]}
            value={slot.start}
            onChangeText={(t) => updateSlot(i, { start: t })}
            placeholder="HH:mm"
          />
          <Text style={styles.slotSep}>a</Text>
          <TextInput
            style={[styles.input, styles.inputTime]}
            value={slot.end}
            onChangeText={(t) => updateSlot(i, { end: t })}
            placeholder="HH:mm"
          />
          <Pressable onPress={() => removeSlot(i)}>
            <Text style={styles.linkDanger}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addSlot}>
        <Text style={styles.link}>+ Añadir franja</Text>
      </Pressable>
    </View>
  );
}

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
  return (
    <View style={styles.step}>
      <Text style={styles.body}>¿Con qué equipamiento cuentas?</Text>
      {ALL_EQUIPMENT.map((id) => (
        <Pressable
          key={id}
          style={styles.checkRow}
          onPress={() => setEquipment({ ...equipment, [id]: !equipment[id] })}
        >
          <View style={[styles.checkbox, equipment[id] && styles.checkboxChecked]}>
            {equipment[id] && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.body}>{equipmentLabel(id)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

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
  const addInjury = () =>
    setRestrictions({ ...injuriacts(), injuries: [...restrictions.injuries, ''] });

  return (
    <View style={styles.step}>
      <Text style={styles.body}>
        ¿Tienes lesiones activas o limitaciones que el plan deba respetar? Si no, pasa al resumen.
      </Text>
      {restrictions.injuries.map((injury, i) => (
        <View key={i} style={styles.slotRow}>
          <TextInput
            style={[styles.input, styles.inputFlex]}
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
          >
            <Text style={styles.linkDanger}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addInjury}>
        <Text style={styles.link}>+ Añadir lesión</Text>
      </Pressable>

      <Text style={styles.label}>Otras notas</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={restrictions.notes}
        onChangeText={(notes) =>
          setRestrictions({ injuries: restrictions.injuries, notes })
        }
        placeholder="Preferencias, alergias, etc."
        multiline
      />
    </View>
  );
}

function injuriacts() {
  return { injuries: [] as string[], notes: '' };
}

function SummaryStep({ profile }: { profile: Profile }) {
  return (
    <View style={styles.step}>
      <Text style={styles.title}>Resumen</Text>
      <Text style={styles.body}>
        {profile.name ? `${profile.name}, ` : ''}experiencia {experienceLabel(profile.experience)}.
      </Text>
      <Text style={styles.body}>
        Objetivo principal: {profile.primaryGoal.description || '(vacío)'}
      </Text>
      <Text style={styles.body}>
        {profile.secondaryGoals.length} objetivo(s) secundario(s).
      </Text>
      <Text style={styles.body}>
        Dispones de {Object.values(profile.equipment).filter(Boolean).length} piezas de equipamiento.
      </Text>
      {profile.restrictions.injuries.length > 0 && (
        <Text style={styles.body}>
          {profile.restrictions.injuries.length} lesión(es) o limitación(es) registrada(s).
        </Text>
      )}
      <Text style={styles.body}>
        Toca "Confirmar" para guardar el perfil.
      </Text>
    </View>
  );
}

// --- Estilos (alineados con Identidad-visual) ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2', // Canvas
  },
  content: {
    padding: 24,
    paddingBottom: 80,
  },
  stepLabel: {
    fontSize: 12,
    color: '#20231F',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  step: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#20231F',
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: '#20231F',
    marginBottom: 12,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#20231F',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EAE3',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#20231F',
    marginBottom: 8,
    minHeight: 48,
  },
  inputMulti: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputTime: {
    flex: 1,
    minWidth: 80,
  },
  inputFlex: {
    flex: 1,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  slotSep: {
    color: '#20231F',
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9EAE3',
    backgroundColor: '#FFFFFF',
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#C8F169',
    borderColor: '#C8F169',
  },
  chipText: {
    fontSize: 14,
    color: '#20231F',
    fontWeight: '500',
  },
  chipTextActive: {
    fontSize: 14,
    color: '#20231F',
    fontWeight: '600',
  },
  subItem: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9EAE3',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#20231F',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#C8F169',
    borderColor: '#C8F169',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#20231F',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPrimary: {
    backgroundColor: '#C8F169',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EAE3',
  },
  buttonTextPrimary: {
    color: '#20231F',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#20231F',
    fontSize: 16,
    fontWeight: '500',
  },
  link: {
    color: '#20231F',
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  linkDanger: {
    color: '#A33',
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
});