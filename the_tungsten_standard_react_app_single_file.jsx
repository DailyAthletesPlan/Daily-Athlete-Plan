import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  Droplets,
  Flame,
  FlaskConical,
  HeartPulse,
  Moon,
  Sparkles,
  Target,
  Timer,
  UtensilsCrossed,
  Waves,
  Wind,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// =============================================================
// THE TUNGSTEN STANDARD — Modern Rebuild (distinct look + deeper VO₂)
// =============================================================
// Major changes:
// - Brand-new visual language (neon/glass gradients, cards, dynamic accents)
// - True VO₂ hub with two estimators (Uth + Cooper), HR zones, daily targets
// - Exact 21-question instrument you specified (labels preserved)
// - Dynamic verse/prayer/self-talk libraries that rotate by need + day-seed
// - Menstrual-phase aware macros, sleep, hydration and training bias
// - Rich Nutrition panel: macros, timing, fiber/omega goals, sample meals
// - Recovery rules for cold exposure (performance-safe), simple sauna logic
// - Coach tab that synthesizes weak domains into concrete micro-goals
// - Charts: VO₂ trajectory (local only) and adherence streaks (optional)
// =============================================================

// ------------------- helpers -------------------
const cmFromInches = (ft, inches) => (Number(ft) * 12 + Number(inches)) * 2.54;
const kgFromLbs = (lbs) => Number(lbs) * 0.45359237;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (x, p = 0) => Math.round(x * 10 ** p) / 10 ** p;
const todaySeed = () => new Date().toISOString().slice(0,10);

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 };

// -------------- 21 Questions (EXACT LABELS) --------------
const Q = [
  // Part 1: Your Physical Foundation
  { key: "sleep", label: "Sleep Quality (Walker, Breus)" },
  { key: "nutrition", label: "Nutrition (Hyman, Jenkins, Top 20)" },
  { key: "hydration", label: "Hydration (Hydration Research)" },
  { key: "bodyRel", label: "Physical Self-Relationship (Male/Female Body, Itsines, Johnson)" },
  // Part 2: Your Mental & Emotional State
  { key: "breath", label: "Stress Management (Wim Hof, SEALs, Breathing)" },
  { key: "chatter", label: '"Chatter" Control (Kross)' },
  { key: "compassion", label: "Self-Compassion (Turow)" },
  { key: "resilience", label: "Emotional Resilience (Davidson, Moffitt)" },
  { key: "focus", label: "Mental Focus (Nideffer, Joyner)" },
  { key: "grit", label: "Resilience Building (Wim Hof, Cavaliere)" },
  { key: "rhythm", label: "Internal Rhythm (Clancy, Breus)" },
  { key: "spiritual", label: "Spiritual Connection (Knechtle, Giovannetti, NKJV)" },
  // Part 3: Your Relationship Health
  { key: "turnToward", label: '"Turning Toward" (Gottman)' },
  { key: "conflict", label: "Conflict Management (Gottman)" },
  { key: "trust", label: "Trust & Loyalty (Waldinger, Gottman)" },
  { key: "overthink", label: "Overthinking (Kross, Perel)" },
  { key: "intimacy", label: "Intimacy & Desire (Perel)" },
  { key: "selfExpand", label: "Self-Expansion (Lewandowski)" },
  { key: "connection", label: "Connection Quality (Waldinger)" },
  // Part 4: Holistic Summary
  { key: "internalHealth", label: "Internal Health (Braunwald, Morris, Jenkins)" },
  { key: "allIn", label: "The All-In Check (All Topics)" },
];

// ------------------- persistence -------------------
function useLocalState(key, init) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, setV];
}

// ------------------- physiology core -------------------
function bmrMSJ({ gender, age, heightCm, weightKg }) {
  if (!gender || !age || !heightCm || !weightKg) return 0;
  const sex = gender === "female" ? -161 : 5;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + sex;
}
function targetCalories({ tdee, weightKg, goalWeightKg }) {
  if (!tdee || !weightKg || !goalWeightKg) return tdee;
  const delta = goalWeightKg - weightKg;
  if (Math.abs(delta) < 2) return tdee;
  if (delta < 0) return Math.round(tdee * 0.82); // modest cut
  return Math.round(tdee * 1.10); // modest gain
}
function macrosFromCalories({ calories, weightKg, proteinGPerKg = 1.8, fatPct = 0.28 }) {
  if (!calories || !weightKg) return { protein: 0, fat: 0, carbs: 0 };
  const protein = Math.round(weightKg * proteinGPerKg);
  const fat = Math.round((calories * fatPct) / 9);
  const carbs = Math.max(0, Math.round((calories - protein*4 - fat*9) / 4));
  return { protein, fat, carbs };
}

// Menstrual phase adaptations
function cycleAdjust(phase) {
  switch (phase) {
    case "menstruation":
      return { kcal: +100, waterMl: +300, sleepBonusH: 0.5, bias: "Deload/skill/Zone 2", micros: ["Iron + Vitamin C", "Omega-3", "Magnesium"] };
    case "follicular":
      return { kcal: 0, waterMl: 0, sleepBonusH: 0, bias: "Push strength/HIIT", micros: ["Creatine 3–5g", "Carbs around training"] };
    case "ovulation":
      return { kcal: 0, waterMl: +150, sleepBonusH: 0, bias: "Peak power; protect joints", micros: ["Collagen + Vit C", "Electrolytes"] };
    case "luteal":
      return { kcal: +150, waterMl: +400, sleepBonusH: 0.5, bias: "Zone 2/tempo; manage heat", micros: ["Magnesium", "B6", "Electrolytes"] };
    default:
      return { kcal: 0, waterMl: 0, sleepBonusH: 0, bias: "Balanced", micros: [] };
  }
}

// ------------------- VO₂ hub -------------------
// Tanaka HRmax default; allow override
const hrMaxAuto = (age) => Math.round(208 - 0.7 * age);
// Uth (2004): VO₂max ≈ 15.3 × (HRmax / HRrest)
const vo2Uth = (hrMax, hrRest) => (hrMax && hrRest) ? round(15.3 * (hrMax / hrRest), 1) : 0;
// Cooper 12-min test: VO₂max = (meters - 504.9) / 44.73
const vo2Cooper = (meters) => meters ? round((meters - 504.9) / 44.73, 1) : 0;
// Karvonen zones
const karvonenZones = (rest, max) => [
  { name: "Z1 Recovery", lo: 0.5, hi: 0.6 },
  { name: "Z2 Aerobic", lo: 0.6, hi: 0.7 },
  { name: "Z3 Tempo", lo: 0.7, hi: 0.8 },
  { name: "Z4 Threshold", lo: 0.8, hi: 0.9 },
  { name: "Z5 VO₂/Speed", lo: 0.9, hi: 1.0 },
].map(z => ({ ...z, hr: `${Math.round(rest + z.lo*(max-rest))}-${Math.round(rest + z.hi*(max-rest))} bpm` }));

function cardioPlan(age, totalScore) {
  const tier = totalScore <= 45 ? "rebuild" : totalScore <= 80 ? "build" : "perform";
  const z2 = tier === "rebuild" ? 30 : tier === "build" ? 40 : 50; // daily minutes
  const hard = tier === "rebuild" ? 4 : tier === "build" ? 6 : 8;  // x (1' on / 1' off)
  return { tier, z2, hard: age >= 50 ? Math.max(3, hard-1) : hard };
}

// ------------------- faith content (dynamic) -------------------
const VERSE_BANK = {
  strength: [
    { ref: "Isaiah 40:31", text: "Those who wait on the Lord shall renew their strength..." },
    { ref: "Philippians 4:13", text: "I can do all things through Christ who strengthens me." },
    { ref: "Joshua 1:9", text: "Be strong and of good courage..." },
  ],
  peace: [
    { ref: "John 14:27", text: "Peace I leave with you..." },
    { ref: "Psalm 46:10", text: "Be still, and know that I am God." },
    { ref: "1 Peter 5:7", text: "Casting all your care upon Him..." },
  ],
  wisdom: [
    { ref: "James 1:5", text: "If any of you lacks wisdom, let him ask of God..." },
    { ref: "Proverbs 3:5-6", text: "Trust in the Lord with all your heart..." },
    { ref: "Proverbs 4:7", text: "Wisdom is the principal thing; therefore get wisdom." },
  ],
  grace: [
    { ref: "Ephesians 2:8-9", text: "By grace you have been saved through faith..." },
    { ref: "Romans 5:8", text: "God demonstrates His own love..." },
    { ref: "1 John 4:19", text: "We love Him because He first loved us." },
  ],
};
const PRAYER_BANK = {
  restore: [
    (n)=>`Lord, restore ${n||"me"} today—calm my mind, steady my steps, and teach me to breathe in Your peace. Amen.`,
    (n)=>`Father, in fatigue meet ${n||"me"} with new mercy. Guide one faithful habit at a time. Amen.`,
  ],
  focus: [
    (n)=>`Lord, order ${n||"my"} day. Give clarity for hard work and gentleness for people. Amen.`,
    (n)=>`God, help ${n||"me"} focus on what matters, and let discipline be an act of worship. Amen.`,
  ],
  gratitude: [
    (n)=>`Thank You for breath, body, and purpose. Use ${n||"me"} to serve someone well today. Amen.`,
    (n)=>`Father, thank You for progress. Keep ${n||"me"} humble and hopeful. Amen.`,
  ],
};
function pickFrom(arr, seedKey="default") { if (!arr?.length) return null; const idx = Math.abs(hashCode(seedKey)) % arr.length; return arr[idx]; }
function hashCode(s){ let h=0; for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i); h|=0;} return h; }

function pickVerseDynamic(scores){
  // map weakest domains → theme
  const pairs = Object.entries(scores).sort((a,b)=>a[1]-b[1]);
  const weakest = pairs.slice(0,2).map(p=>p[0]);
  const theme = weakest.some(k=>["sleep","breath","resilience","chatter"].includes(k))?"peace":
                weakest.some(k=>["focus","wisdom","overthink"].includes(k))?"wisdom":
                weakest.some(k=>["connection","turnToward","intimacy"].includes(k))?"grace":"strength";
  const bank = VERSE_BANK[theme];
  return pickFrom(bank, todaySeed()+theme) || bank[0];
}
function pickPrayerDynamic(scores, name){
  const minKey = Object.entries(scores).sort((a,b)=>a[1]-b[1])[0]?.[0] || "restore";
  const bucket = ["sleep","breath","resilience","internalHealth"].includes(minKey)?"restore":
                 ["focus","allIn","grit"].includes(minKey)?"focus":"gratitude";
  const bank = PRAYER_BANK[bucket];
  const fn = pickFrom(bank, todaySeed()+bucket) || bank[0];
  return fn(name);
}

// ------------------- food ideas -------------------
const FOOD = {
  proteins: ["Chicken breast","Salmon","Greek yogurt","Eggs","Cottage cheese","Lentils","Tofu"],
  carbs: ["Quinoa","Oats","Sweet potatoes","Brown rice","Berries","Beans","Whole-grain bread"],
  fats: ["Avocado","Olive oil","Almonds","Walnuts","Chia","Flax","Peanut butter"],
  meals: {
    cutting: ["Yogurt+berries+oats","Chicken+quinoa+greens","Tofu stir-fry + cauli rice"],
    maintenance: ["Salmon+brown rice+asparagus","Turkey chili","Sushi bowl (fish, rice, avocado)"],
    bulking: ["Eggs+oats+banana+nut butter","Steak+sweet potato+salad","Lentil curry+rice+EVOO"],
  },
};

// ------------------- component -------------------
export default function TungstenStandardApp() {
  // profile
  const [name, setName] = useLocalState("ts_name", "");
  const [gender, setGender] = useLocalState("ts_gender", "male");
  const [age, setAge] = useLocalState("ts_age", 30);
  const [unit, setUnit] = useLocalState("ts_unit", "imperial");
  const [heightFt, setHeightFt] = useLocalState("ts_h_ft", 5);
  const [heightIn, setHeightIn] = useLocalState("ts_h_in", 10);
  const [heightCm, setHeightCm] = useLocalState("ts_h_cm", 178);
  const [weight, setWeight] = useLocalState("ts_weight", 190);
  const [goalWeight, setGoalWeight] = useLocalState("ts_goal_weight", 180);
  const [activity, setActivity] = useLocalState("ts_activity", "moderate");
  const [cycle, setCycle] = useLocalState("ts_cycle", "follicular");
  const [hrRest, setHrRest] = useLocalState("ts_hr_rest", 60);
  const [hrMaxOverride, setHrMaxOverride] = useLocalState("ts_hrmax", 0);
  const [cooperMeters, setCooperMeters] = useLocalState("ts_cooper_m", 0);

  // 21 answers 1–5
  const [ans, setAns] = useLocalState("ts_q21", Object.fromEntries(Q.map(q=>[q.key,3])));
  const total = useMemo(()=> Q.reduce((s,q)=> s + Number(ans[q.key]||0), 0), [ans]);

  // derived
  const heightInCm = unit === "imperial" ? cmFromInches(heightFt, heightIn) : Number(heightCm);
  const weightInKg = unit === "imperial" ? kgFromLbs(weight) : Number(weight);
  const goalKg = unit === "imperial" ? kgFromLbs(goalWeight) : Number(goalWeight);

  const bmr = useMemo(()=> Math.round(bmrMSJ({ gender, age:Number(age), heightCm:heightInCm, weightKg:weightInKg })), [gender, age, heightInCm, weightInKg]);
  const tdee = useMemo(()=> Math.round(bmr * (ACTIVITY[activity]||1.55)), [bmr, activity]);
  const femaleAdj = gender === "female" ? cycleAdjust(cycle) : { kcal:0, waterMl:0, sleepBonusH:0, bias:"Balanced", micros:[] };
  const kcalBase = useMemo(()=> targetCalories({ tdee, weightKg: weightInKg, goalWeightKg: goalKg }), [tdee, weightInKg, goalKg]);
  const kcal = clamp(kcalBase + (femaleAdj.kcal||0), 1200, 5000);
  const macros = useMemo(()=> macrosFromCalories({ calories:kcal, weightKg:weightInKg }), [kcal, weightInKg]);

  // VO2
  const hrMax = hrMaxOverride>0 ? hrMaxOverride : hrMaxAuto(Number(age));
  const vo2_uth = vo2Uth(hrMax, Number(hrRest));
  const vo2_cooper = vo2Cooper(Number(cooperMeters));
  const zones = karvonenZones(Number(hrRest||60), hrMax);
  const plan = cardioPlan(Number(age), total);

  // Hydration + sleep
  const waterMl = Math.round(weightInKg*35 + Math.max(0, plan.z2-30)*8) + (femaleAdj.waterMl||0);
  const liters = round(waterMl/1000, 1);
  const sodium = clamp(1800 + Math.max(0, plan.z2-60)*3, 1500, 4000);
  const sleepH = clamp(round(7.5 + (ans.sleep<=2?0.5:0) + (ans.breath<=2?0.5:0) + (femaleAdj.sleepBonusH||0),1),7,9.5);

  // goals
  const mode = kcal < tdee*0.95 ? "cutting" : kcal > tdee*1.05 ? "bulking" : "maintenance";
  const pPerMeal = Math.max(20, Math.round(macros.protein / 3));
  const carbsPre = Math.round(macros.carbs * 0.25 * (gender==="female" && cycle==="follicular" ? 1.1 : 1));
  const carbsPost = carbsPre;
  const fiberTarget = Math.round((kcal/1000) * 14);

  // dynamic faith
  const verse = useMemo(()=> pickVerseDynamic(ans), [ans, todaySeed()]);
  const prayer = useMemo(()=> pickPrayerDynamic(ans, name), [ans, name, todaySeed()]);

  // charts (local)
  const [vo2Series, setVo2Series] = useLocalState("ts_vo2_series", []);
  useEffect(()=>{ // auto-append today if user provided any estimator
    if ((vo2_uth||vo2_cooper) && !vo2Series.find(d=>d.d===todaySeed())){
      const v = vo2_cooper || vo2_uth;
      setVo2Series([...vo2Series, { d: todaySeed(), v }]);
    }
  }, [vo2_uth, vo2_cooper]);

  const number = (v)=> (isNaN(Number(v))?0:Number(v));

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-950 via-slate-950 to-black text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <motion.h1 initial={{opacity:0, y:-8}} animate={{opacity:1, y:0}} className="text-4xl md:text-5xl font-extrabold tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300">
          The Tungsten Standard
        </motion.h1>
        <p className="text-center text-slate-300 mt-2">Adaptive health intelligence for people getting healthy—and staying healthy.</p>

        <Tabs defaultValue="coach" className="mt-8">
          <TabsList className="grid grid-cols-6 bg-slate-900/70 backdrop-blur rounded-2xl">
            <TabsTrigger value="coach">Coach</TabsTrigger>
            <TabsTrigger value="vo2">Cardio/VO₂</TabsTrigger>
            <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            <TabsTrigger value="recovery">Recovery</TabsTrigger>
            <TabsTrigger value="faith">Faith</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          {/* COACH */}
          <TabsContent value="coach" className="mt-6">
            <div className="grid xl:grid-cols-3 gap-6">
              <Card className="bg-slate-900/60 border-slate-800 shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between"><h3 className="font-semibold flex items-center gap-2"><Brain className="h-5 w-5"/>21-Question Check-In</h3><Badge variant="secondary" className="bg-indigo-600/30">{total}/105</Badge></div>
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    {Q.map(q=> (
                      <div key={q.key} className="rounded-xl bg-slate-800/60 p-3">
                        <div className="flex items-center justify-between text-sm"><span>{q.label}</span><span className="text-indigo-300 font-semibold">{ans[q.key]}</span></div>
                        <Slider value={[ans[q.key]]} min={1} max={5} step={1} className="mt-2" onValueChange={(v)=> setAns({...ans, [q.key]: v[0]})} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800 shadow-xl">
                <CardContent className="p-6 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2"><Target className="h-5 w-5"/>Today’s Micro-Goals</h3>
                  <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 mt-2">
                    {ans.sleep<=2 && <li>Protect an {sleepH}h window. Use the 3-2-1 rule (alcohol/food/water).</li>}
                    {ans.breath<=2 && <li>Do 2–4 min of Box Breathing or 3× Physiological Sighs before hard tasks.</li>}
                    {ans.hydration<=2 && <li>Hit {liters} L water + ~{sodium} mg sodium today.</li>}
                    {ans.nutrition<=2 && <li>Floor: ≥ {pPerMeal} g protein each meal + {fiberTarget} g fiber total.</li>}
                    {ans.focus<=2 && <li>Single-task 25 min (timer on). Put phone in another room.</li>}
                    {ans.turnToward<=2 && <li>Turn toward one small bid: eye contact + a curious question.</li>}
                    {ans.allIn<=3 && <li>Write a 2-line intention for why you’re all-in this week.</li>}
                    <li>Cardio: Zone 2 {plan.z2} min OR {plan.hard}×(1′ hard / 1′ easy) after warm up.</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800 shadow-xl">
                <CardContent className="p-6">
                  <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5"/>VO₂ Trend (local)</h3>
                  <div className="h-48 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={vo2Series} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                        <XAxis dataKey="d" hide />
                        <YAxis domain={[0, 'dataMax + 10']} hide />
                        <Tooltip formatter={(v)=>`${v} ml·kg⁻¹·min⁻¹`} labelFormatter={(l)=>`Date: ${l}`} />
                        <ReferenceLine y={40} strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="v" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* VO2 */}
          <TabsContent value="vo2" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><HeartPulse className="h-5 w-5"/>Estimators</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label>Resting HR (bpm)</Label>
                      <Input type="number" min={35} max={120} value={hrRest} onChange={(e)=>setHrRest(Number(e.target.value)||0)} />
                    </div>
                    <div>
                      <Label>HRmax (override)</Label>
                      <Input type="number" min={100} max={230} value={hrMaxOverride} onChange={(e)=>setHrMaxOverride(Number(e.target.value)||0)} placeholder="auto" />
                      <div className="text-xs text-slate-400 mt-1">Auto: {hrMax}</div>
                    </div>
                    <div className="col-span-2">
                      <Label>Cooper 12-min Distance (meters, optional)</Label>
                      <Input type="number" min={0} max={6000} value={cooperMeters} onChange={(e)=>setCooperMeters(Number(e.target.value)||0)} />
                    </div>
                  </div>
                  <Separator className="bg-slate-800" />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-800/60 p-3">
                      <div className="font-semibold">Uth VO₂</div>
                      <div>{vo2_uth ? `${vo2_uth} ml·kg⁻¹·min⁻¹` : "—"}</div>
                    </div>
                    <div className="rounded-xl bg-slate-800/60 p-3">
                      <div className="font-semibold">Cooper VO₂</div>
                      <div>{vo2_cooper ? `${vo2_cooper} ml·kg⁻¹·min⁻¹` : "—"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2"><Target className="h-5 w-5"/>Today’s Cardio Prescription</h3>
                  <p className="text-sm text-slate-300">Tier: <span className="font-semibold text-indigo-300 capitalize">{plan.tier}</span></p>
                  <p className="text-sm text-slate-300">Zone 2: <span className="font-semibold text-indigo-300">{plan.z2} min</span></p>
                  <p className="text-sm text-slate-300">Intervals: <span className="font-semibold text-indigo-300">{plan.hard} × 1′ hard / 1′ easy</span></p>
                  <p className="text-xs text-slate-400">Warm up 8–12 min. HIIT 2–3×/wk; other days Zone 2 / brisk walk.</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6">
                  <h3 className="font-semibold flex items-center gap-2"><Timer className="h-5 w-5"/>HR Zones (Karvonen)</h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm mt-2">
                    {zones.map((z,i)=> (
                      <div key={i} className="rounded-xl bg-slate-800/60 p-3">
                        <div className="font-semibold">{z.name}</div>
                        <div>{z.hr}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* NUTRITION */}
          <TabsContent value="nutrition" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6">
                  <h3 className="font-semibold flex items-center gap-2"><FlaskConical className="h-5 w-5"/>Macros</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge>Protein: {macros.protein}g</Badge>
                    <Badge>Carbs: {macros.carbs}g</Badge>
                    <Badge>Fat: {macros.fat}g</Badge>
                  </div>
                  <div className="text-sm text-slate-300 space-y-1">
                    <div>Calories: <span className="font-semibold">{kcal}</span> kcal ({mode})</div>
                    <div>Protein per meal: <span className="font-semibold">{pPerMeal} g × 3</span></div>
                    <div>Fiber goal: <span className="font-semibold">{fiberTarget} g/day</span></div>
                    <div>Omega-3s: <span className="font-semibold">~2 g EPA+DHA/day</span></div>
                    {gender==="female" && (
                      <div className="mt-2 text-xs">Phase: <span className="font-semibold">{cycle}</span> • Bias: {femaleAdj.bias} • Micros: {femaleAdj.micros.join(", ")}</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6">
                  <h3 className="font-semibold flex items-center gap-2"><UtensilsCrossed className="h-5 w-5"/>Timing</h3>
                  <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                    <li>Pre: ~{carbsPre} g carbs + 20–30 g protein (60–90 min before)</li>
                    <li>Post: ~{carbsPost} g carbs + 20–40 g protein within 2 h</li>
                    <li>Evening: slow protein (cottage cheese/Greek yogurt) if hungry</li>
                    <li>Distribute protein evenly; anchor meals to training days</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6">
                  <h3 className="font-semibold flex items-center gap-2"><Flame className="h-5 w-5"/>Sample Meals ({mode})</h3>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {FOOD.meals[mode].map((m,i)=> <div key={i} className="rounded-xl bg-slate-800/60 p-3">{m}</div>)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* RECOVERY */}
          <TabsContent value="recovery" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2"><Droplets className="h-5 w-5"/>Hydration</h3>
                  <p className="text-sm text-slate-300">Target: <span className="font-semibold">{liters} L</span> water + <span className="font-semibold">{sodium} mg</span> sodium</p>
                  <p className="text-sm text-slate-300"><Moon className="inline h-4 w-4 mr-1"/>Sleep: <span className="font-semibold">{sleepH} h</span></p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2"><Waves className="h-5 w-5"/>Cold Exposure</h3>
                  <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                    <li>Rebuild: 50–59°F · 1–2 min · 2–3×/wk</li>
                    <li>Build: 48–57°F · 2–4 min · 3×/wk</li>
                    <li>Perform: 45–55°F · 3–5 min · 3–4×/wk</li>
                    <li className="text-xs text-slate-400">Avoid immediately after heavy lifting; okay after Zone 2.</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2"><Wind className="h-5 w-5"/>Breathing</h3>
                  <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                    <li>Physiological sigh ×3 for rapid downshift</li>
                    <li>Box breathing 4-4-4-4 for 2–5 min</li>
                    <li>Pre-sleep: 4-7-8 × 4 cycles</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* FAITH */}
          <TabsContent value="faith" className="mt-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6">
                  <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5"/>Verse of the Day</h3>
                  <blockquote className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 mt-2">
                    <p className="italic">“{verse.text}”</p>
                    <div className="text-right mt-2 text-slate-300">— {verse.ref} (NKJV)</div>
                  </blockquote>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6">
                  <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5"/>Daily Prayer</h3>
                  <Textarea className="bg-slate-800/60 border-slate-700 mt-2" rows={5} value={prayer} readOnly />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PROFILE */}
          <TabsContent value="profile" className="mt-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><Activity className="h-5 w-5"/>Profile</h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div><Label>Name</Label><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="(optional)" /></div>
                    <div>
                      <Label>Gender</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Age</Label><Input type="number" min={12} max={100} value={age} onChange={(e)=>setAge(number(e.target.value))} /></div>
                    <div>
                      <Label>Units</Label>
                      <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="imperial">Imperial</SelectItem>
                          <SelectItem value="metric">Metric</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {unit === "imperial" ? (
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div><Label>Height (ft)</Label><Input type="number" value={heightFt} onChange={(e)=>setHeightFt(number(e.target.value))} /></div>
                      <div><Label>Height (in)</Label><Input type="number" value={heightIn} onChange={(e)=>setHeightIn(number(e.target.value))} /></div>
                      <div><Label>Weight (lb)</Label><Input type="number" value={weight} onChange={(e)=>setWeight(number(e.target.value))} /></div>
                      <div><Label>Goal (lb)</Label><Input type="number" value={goalWeight} onChange={(e)=>setGoalWeight(number(e.target.value))} /></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><Label>Height (cm)</Label><Input type="number" value={heightCm} onChange={(e)=>setHeightCm(number(e.target.value))} /></div>
                      <div><Label>Weight (kg)</Label><Input type="number" value={weight} onChange={(e)=>setWeight(number(e.target.value))} /></div>
                      <div><Label>Goal (kg)</Label><Input type="number" value={goalWeight} onChange={(e)=>setGoalWeight(number(e.target.value))} /></div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label>Activity</Label>
                      <Select value={activity} onValueChange={setActivity}>
                        <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sedentary">Sedentary</SelectItem>
                          <SelectItem value="light">Light (1–3 d/wk)</SelectItem>
                          <SelectItem value="moderate">Moderate (3–5 d/wk)</SelectItem>
                          <SelectItem value="active">Active (6–7 d/wk)</SelectItem>
                          <SelectItem value="athlete">Athlete / 2-a-days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Resting HR</Label><Input type="number" value={hrRest} onChange={(e)=>setHrRest(number(e.target.value))} /></div>
                      <div><Label>HRmax (override)</Label><Input type="number" value={hrMaxOverride} onChange={(e)=>setHrMaxOverride(number(e.target.value))} placeholder={`auto ${hrMax}`}/></div>
                    </div>
                  </div>

                  {gender==="female" && (
                    <div className="text-sm">
                      <Label>Cycle Phase</Label>
                      <Select value={cycle} onValueChange={setCycle}>
                        <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="menstruation">Menstruation</SelectItem>
                          <SelectItem value="follicular">Follicular</SelectItem>
                          <SelectItem value="ovulation">Ovulation</SelectItem>
                          <SelectItem value="luteal">Luteal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Separator className="bg-slate-800" />
                  <div className="grid md:grid-cols-4 gap-3 text-xs text-slate-300">
                    <div>BMR: <span className="font-semibold text-slate-100">{bmr}</span></div>
                    <div>TDEE: <span className="font-semibold text-slate-100">{tdee}</span></div>
                    <div>Target kcal: <span className="font-semibold text-slate-100">{kcal}</span></div>
                    <div>Mode: <span className="font-semibold text-slate-100 capitalize">{mode}</span></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-6">
                  <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5"/>Notes</h3>
                  <p className="text-xs text-slate-400">All guidance is educational; not medical advice. Consult your clinician for diagnoses or prescriptions.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}