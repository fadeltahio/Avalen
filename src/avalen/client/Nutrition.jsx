// A client's food diary: today's targets, logging a meal (search, favourites,
// manual entry or a photo), and how the day compares with water and step goals.
import { useRef, useState } from 'react';
import { Camera, Check, ChevronLeft, ChevronRight, Heart, Plus, ScanBarcode, Search, Utensils } from 'lucide-react';
import { MotionList, MotionDetails } from '../motion.jsx';
import { useApp } from '../context.js';
import { recordFood, ensureNutritionDay, nutritionDay } from '../nutrition-model.js';
import { dayKey, offsetDay, round, saveFile, shortDate, sum, uid } from '../store.js';
import { CoachMealPlan } from '../nutrition-home.jsx';
import { PhotoMealLogger } from '../meal-photo.jsx';
import { ALL_FOODS, searchFoods } from '../food-library.js';
import { BarcodeScan } from '../BarcodeScan.jsx';
import { Hydration } from '../ReferenceMotion.jsx';
import { Button, Empty, Field, IconButton, Media, Meter, Modal, Notice, Ring, SectionHead, Stat, Tabs } from '../ui.jsx';
import { language, t } from '../i18n.js';
import { portionLabel } from '../portions.js';

function DailyUpdates({ date, foods }) {
  const { data, client } = useApp();
  const [tab, setTab] = useState('Recommendations');
  const targets = nutritionDay(data,client.id,date)?.target || client.nutrition;
  const habits = data.habitLogs.find(h => h.clientId === client.id && h.date === date)?.values || {};
  const rows = [
    {title:'Reach your protein target',value:sum(foods,'p'),target:targets.p,unit:'g',tone:'green'},
    ...(client.habits.some(h => h.id === 'water') ? [{title:'Drink more water',value:habits.water || 0,target:client.habits.find(h => h.id === 'water').target,unit:'L',tone:'blue'}] : []),
    ...(client.habits.some(h => h.id === 'steps') ? [{title:'Move a little more',value:habits.steps || 0,target:client.habits.find(h => h.id === 'steps').target,unit:'steps',tone:'amber'}] : []),
  ];
  return <section className="daily-updates"><h2>{t('Daily updates')}</h2><Tabs label={t('Daily updates')} items={['Meals','Recommendations','Water']} value={tab} onChange={setTab}/>
    {tab === 'Recommendations' ? rows.map(r => <div className="recommendation" key={r.title}><div><h3>{r.value >= r.target ? r.unit === 'g' ? t('Protein target reached') : r.unit === 'L' ? t('Water target reached') : t('Step target reached') : r.title}</h3><strong>{r.value.toLocaleString()}<small> {r.unit}</small></strong></div><Meter value={r.value} target={r.target} tone={r.tone}/><p>{r.value >= r.target ? t('Your coach’s daily target is complete.') : t('{value} {unit} away from your coach’s target', { value: round(r.target - r.value).toLocaleString(), unit: r.unit })}</p></div>) : tab === 'Water' ? <Hydration date={date}/> : <div className="daily-meals">{['Breakfast','Lunch','Dinner','Snack'].map(meal => { const entries = foods.filter(f => f.meal === meal); return <div className="recommendation" key={meal}><div><h3>{meal}</h3><strong>{sum(entries,'kcal')}<small> kcal</small></strong></div><p>{entries.map(f => f.name).join(' · ') || t('No food logged yet')}</p></div>; })}</div>}
  </section>;
}


export function Nutrition() {
  const { data, client, update, ask, notify, viewDate, setViewDate, subtab } = useApp();
  const [planOpen, setPlanOpen] = useState(subtab === 'Coach plan');
  const [editingFood, setEditingFood] = useState(null);
  const date = viewDate || dayKey(), setDate = setViewDate;
  const [add, setAdd] = useState(false);
  const [detail, setDetail] = useState(null);
  const [removing, setRemoving] = useState(false), [removalError, setRemovalError] = useState('');
  const [plannedMeal,setPlannedMeal] = useState(null);
  const [completing, setCompleting] = useState(false), [completionError, setCompletionError] = useState('');
  const foods = data.foodLogs.filter(
    (x) => x.clientId === client.id && x.date === date,
  );
  const dayRecord = nutritionDay(data, client.id, date);
  const targets = dayRecord?.target || client.nutrition;
  return (
    <>
      <div className="date-select">
        <IconButton
          label={t('Previous nutrition day')}
          onClick={() => setDate(offsetDay(-1, date))}
        >
          <ChevronLeft size={16} />
        </IconButton>
        <span>{date === dayKey() ? t('Today') : shortDate(date)}</span>
        <IconButton
          label={t('Next nutrition day')}
          disabled={date === dayKey()}
          onClick={() => setDate(offsetDay(1, date))}
        >
          <ChevronRight size={16} />
        </IconButton>
      </div>
      <section className="card nutrition-card">
        <SectionHead
          title={t('Your daily targets')}
          action={<span className="pill">{client.nutrition.mode}</span>}
        />
        <div className="rings">
          <Ring
            motionKey={date}
            value={sum(foods, "kcal")}
            target={targets.kcal}
            label={t('Calories')} tone="macro-calories"
          />
          <Ring
            motionKey={date}
            value={sum(foods, "p")}
            target={targets.p}
            unit="g"
            label={t('Protein')}
            tone="macro-protein"
          />
          <Ring
            motionKey={date}
            value={sum(foods, "c")}
            target={targets.c}
            unit="g"
            label={t('Carbs')}
            tone="macro-carbs"
          />
          <Ring
            motionKey={date}
            value={sum(foods, "f")}
            target={targets.f}
            unit="g"
            label={t('Fat')}
            tone="macro-fat"
          />
        </div>
        <div className="nutrition-target-context"><span>{Math.abs(targets.kcal - sum(foods, 'kcal')).toLocaleString()} kcal {sum(foods, 'kcal') <= targets.kcal ? 'remaining' : t('above target')}</span><small>{foods.length} {foods.length === 1 ? 'entry' : 'entries'} {t('logged')}</small></div>
      </section>
      <div className="nutrition-quick-actions"><Button onClick={() => setAdd(true)}><Plus size={18}/>{t('Log food')}</Button><Button secondary onClick={() => setAdd('Photo')}><Camera size={18}/>{t('Photo meal')}</Button></div>
      <MotionDetails className="nutrition-plan-disclosure" open={planOpen} onToggle={event => setPlanOpen(event.currentTarget.open)}><summary><span>{t('Your coach’s meal plan')}<small>{client.nutrition.meals?.length || 0} {client.nutrition.mode === 'Structured' ? 'prescribed' : 'suggested'} {t('meals · quick log')}</small></span><ChevronRight size={18}/></summary><CoachMealPlan onLog={setPlannedMeal}/></MotionDetails>
      <SectionHead
        title={t('Food diary')}
        action={
          <button className="text-link" onClick={() => setAdd(true)}>
            <Plus size={16} /> {t('Add food')}
          </button>
        }
      />
      <MotionList className="card list">
        {foods.length ? (
          foods.map((f) => (
            <button
              className="simple-row"
              key={f.id}
              onClick={() => { setRemovalError(''); setDetail(f); }}
            >
              <span className="food-icon">
                <Utensils size={18} />
              </span>
              <span>
                <b>{t(f.name)}</b>
                <small>
                  {t(f.meal)} · {portionLabel(f.portion)} · {f.p == null ? t('Protein not entered') : t('{p}g protein', { p: f.p })}
                </small>
              </span>
              <b>
                {f.kcal}
                <small>kcal</small>
              </b>
              <ChevronRight size={15} />
            </button>
          ))
        ) : (
          <Empty
            icon={Utensils}
            title={t('A fresh page for today')}
            detail={t('Add a food or meal photo to start your diary.')}
            action={
              <Button small onClick={() => setAdd(true)}>
                {t('Log your first meal')}
              </Button>
            }
          />
        )}
      </MotionList>
      {foods.length > 0 && <div className="nutrition-day-status"><span><b>{dayRecord?.complete ? t('Day complete') : t('Logging in progress')}</b><small>{dayRecord?.complete ? t('Included in your nutrition trend. Editing reopens the day.') : date < dayKey() && !dayRecord ? t('No historical target was saved. Completing this day compares it with the current {value} kcal target.', { value: targets.kcal.toLocaleString() }) : t('Finish logging to include this day in your nutrition trend.')}</small></span><button disabled={completing} onClick={async () => { if (completing) return; setCompleting(true); setCompletionError(''); const result = await update(d => { const day = ensureNutritionDay(d, client, date); day.complete = !day.complete; }); setCompleting(false); if (result?.error) {setCompletionError(result.error); return;} notify?.(dayRecord?.complete ? t('Day reopened') : t('Day marked complete')); }}>{completing ? t('Saving…') : dayRecord?.complete ? t('Reopen day') : t('Finish logging')}<Check size={16}/></button></div>}
      {completionError && <p className="error" role="alert">{completionError}</p>}
      <MotionDetails className="nutrition-updates"><summary><span>{t('Water, steps and recommendations')}<small>{t('How today compares with your coach’s targets')}</small></span><ChevronRight size={18}/></summary><DailyUpdates date={date} foods={foods}/></MotionDetails>
      {editingFood && <PhotoMealLogger initialEntry={editingFood} date={date} onClose={() => setEditingFood(null)}/>}
      {add && (add === 'Photo' ? <PhotoMealLogger date={date} onClose={()=>setAdd(false)}/> : <FoodLogger date={date} onClose={()=>setAdd(false)}/>)}
      {plannedMeal && <PhotoMealLogger date={date} initialMeal={plannedMeal} requirePhoto={false} onClose={()=>setPlannedMeal(null)}/>}
      {detail && (
        <Modal title={detail.name} onClose={() => !removing && setDetail(null)}>
          {detail.photo && (
            <Media
              fileId={detail.photo.id}
              alt={detail.name}
              className="food-photo"
            />
          )}
          <p>
            {portionLabel(detail.portion)} · {t(detail.meal)}
          </p>
          <div className="three-stats">
            <Stat label={t('Protein')} value={detail.p == null ? '—' : `${detail.p}g`} />
            <Stat label={t('Carbs')} value={detail.c == null ? '—' : `${detail.c}g`} />
            <Stat label={t('Fat')} value={detail.f == null ? '—' : `${detail.f}g`} />
          </div>
          <p className="big-number">
            {detail.kcal} <small>kcal</small>
          </p>
          {removalError && <p role="alert" className="error">{removalError}</p>}
          <div className="button-row">
            <Button disabled={removing} onClick={() => { setEditingFood(detail); setDetail(null); }}>{t('Edit entry')}</Button>
            <Button
              secondary
              onClick={() => {
                ask(
                  `${t(detail.name)} · ${detail.kcal} ${t('kcal')} · ${shortDate(detail.date)}`,
                );
                setDetail(null);
              }}
            >
              {t('Ask coach')}
            </Button>
            <Button
              secondary
              disabled={removing}
              onClick={async () => {
                if (removing) return;
                setRemoving(true); setRemovalError('');
                const result = await update((d) => {
                  d.foodLogs = d.foodLogs.filter((f) => f.id !== detail.id);
                  if (nutritionDay(d,client.id,date)) nutritionDay(d,client.id,date).complete = false;
                });
                setRemoving(false);
                if (result?.error) { setRemovalError(result.error); return; }
                notify?.(t('Entry removed'), () => update(d => recordFood(d,client,detail)));
                setDetail(null);
              }}
            >
              {removing ? t('Removing…') : t('Remove entry')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}


export function FoodLogger({ date, onClose, initialTab = 'Search' }) {
  const { data, client, update, notify } = useApp();
  const [review, setReview] = useState(null);
  const recent = [...new Map(data.foodLogs.filter(f => f.clientId === client.id).slice().reverse().map(f => [f.name, f])).values()].slice(0,5);
  const [tab, setTab] = useState(initialTab),
    [query, setQuery] = useState(""),
    [photo, setPhoto] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const uploadLock = useRef(false);
  const [food, setFood] = useState({
    name: "",
    portion: "1 serving",
    kcal: "",
    p: "",
    c: "",
    f: "",
    meal: "Lunch",
  });
  const [scanning, setScanning] = useState(false);
  const foods = searchFoods(
    tab === "Favourites"
      ? ALL_FOODS.filter((f) => data.favorites.includes(f.name))
      : ALL_FOODS,
    query,
  );
  const reviewFood = ({ ar, tags, source, ...f }) => setReview(f);
  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file || uploadLock.current) return;
    const input = e.currentTarget;
    uploadLock.current = true;
    setBusy(true);
    try {
      setPhoto(await saveFile(file));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      uploadLock.current = false;
      setBusy(false);
      input.value = "";
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (uploadLock.current || busy) return;
    if (!food.name.trim()) {
      setError(t('Give this food a name.'));
      return;
    }
    if (food.kcal === "" || ["kcal", "p", "c", "f"].some((key) => !Number.isFinite(Number(food[key])) || Number(food[key]) < 0 || Number(food[key]) > 10000)) {
      setError(t('Enter nutrition values between 0 and 10,000.'));
      return;
    }
    const entry = { ...food, name: food.name.trim(), portion: food.portion.trim() || '1 serving', id: uid(), clientId: client.id, date, photo,
      ...Object.fromEntries(['kcal','p','c','f'].map(k => [k,food[k] === '' ? null : Number(food[k])])), missingMacros:['p','c','f'].filter(k => food[k] === '') };
    setBusy(true);
    const result = await update(d => recordFood(d,client,entry));
    setBusy(false);
    if (result?.error) { setError(result.error); return; }
    notify?.(t('Food added to diary'), () => update(d => { d.foodLogs = d.foodLogs.filter(f => f.id !== entry.id); }));
    onClose();
  }
  if (review) return <PhotoMealLogger key={review.name} initialFood={review} date={date} requirePhoto={false} onBack={() => setReview(null)} onClose={onClose}/>;
  if (tab === 'Photo') return <PhotoMealLogger date={date} onBack={() => setTab('Search')} onClose={onClose}/>;
  return (
    <Modal title={t('Add food')} className="food-logger-modal" canClose={!busy} onClose={onClose}>
      <Tabs
        items={["Search", "Favourites", "Manual", "Photo"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Search" && scanning && (
        <BarcodeScan
          onFound={(f) => { setScanning(false); reviewFood(f); }}
          onManual={() => { setScanning(false); setTab("Manual"); }}
          onCancel={() => setScanning(false)}
        />
      )}
      {["Search", "Favourites"].includes(tab) && !(tab === "Search" && scanning) && (
        <>
          {tab === "Search" && <button type="button" className="food-scan-entry" onClick={() => setScanning(true)}><ScanBarcode size={22}/><span><b>{t('Scan a barcode')}</b><small>{t('Packaged foods from the supermarket')}</small></span><ChevronRight size={18}/></button>}
          <label className="search">
            <Search size={16} />
            <input
              aria-label={t('Search food library')}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search your food library')}
            />
          </label>
          {tab === 'Search' && !query && recent.length > 0 && <div className="recent-foods"><span className="eyebrow">{t('LOG AGAIN')}</span>{recent.map(f => <button key={f.id} onClick={() => setReview(f)}><span><b>{t(f.name)}</b><small>{t('{kcal} kcal · {portion}', { kcal: f.kcal, portion: f.portion })}</small></span><Plus size={18}/></button>)}</div>}
          <div className="food-search-results">
            {foods.map((f) => (
              <div className="food-option" key={f.name}>
                <button
                  onClick={() => reviewFood(f)}
                >
                  <b>{t(f.name)}{f.ar && language() === 'en' && <span className="food-ar" lang="ar" dir="rtl">{f.ar}</span>}</b>
                  <small>{t('{portion} · {kcal} kcal', { portion: portionLabel(f.portion), kcal: f.kcal })}</small>
                </button>
                <IconButton
                  label={t('Favourite {name}', { name: f.name })}
                  onClick={() =>
                    update((d) => {
                      d.favorites = d.favorites.includes(f.name)
                        ? d.favorites.filter((n) => n !== f.name)
                        : [...d.favorites, f.name];
                    })
                  }
                >
                  <Heart
                    size={17}
                    fill={
                      data.favorites.includes(f.name) ? "currentColor" : "none"
                    }
                  />
                </IconButton>
              </div>
            ))}
            {!foods.length && (
              <Empty
                title={tab === 'Favourites' && !query ? t('Your favourites, one tap away') : t('No matching foods')}
                detail={tab === 'Favourites' && !query ? t('Save foods with the heart beside each entry.') : t('Add the values from your meal or food label.')}
                action={<Button secondary onClick={() => {setFood(previous => ({...previous, name:query.trim()}));setTab('Manual');}}>{t('Add a food manually')} <Plus size={16}/></Button>}
              />
            )}
          </div>
          <small className="muted">
            {t('Everyday and Egyptian foods with typical values per portion. For packaged products, scan the barcode to use the label values.')}
          </small>
        </>
      )}
      {["Manual", "Photo"].includes(tab) && (
        <form onSubmit={submit}>
          {tab === "Photo" && (
            <>
              <label className="upload-zone">
                <Camera size={24} />
                <b>
                  {photo ? t('Change meal photo') : t('Choose or take a meal photo')}
                </b>
                <input
                  type="file"
                  disabled={busy}
                  accept="image/*"
                  capture="environment"
                  onChange={upload}
                />
              </label>
              {photo && (
                <Media
                  fileId={photo.id}
                  alt={t('Meal preview')}
                  className="food-photo"
                />
              )}
              <Notice>
                {t('Photo diary: enter the nutrition values below. Automatic food recognition is not connected.')}
              </Notice>
            </>
          )}
          <Field
            label={t('Food / meal name')}
            value={food.name}
            required
            maxLength={120}
            onChange={(e) => setFood({ ...food, name: e.target.value })}
          />
          <Field
            label={t('Portion')}
            maxLength={120}
            value={food.portion}
            onChange={(e) => setFood({ ...food, portion: e.target.value })}
          />
          <Field label={t('Meal')}>
            <select
              value={food.meal}
              onChange={(e) => setFood({ ...food, meal: e.target.value })}
            >
              {["Breakfast", "Lunch", "Dinner", "Snack"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            {[
              ["kcal", "Calories"],
              ["p", "Protein (g)"],
              ["c", "Carbs (g)"],
              ["f", "Fat (g)"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                type="number"
                required={key === "kcal"}
                placeholder={key === "kcal" ? t('Enter calories') : t('Optional')}
                min="0"
                max="10000"
                step="1"
                value={food[key]}
                onChange={(e) =>
                  setFood({
                    ...food,
                    [key]: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                  })
                }
              />
            ))}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? t('Saving photo…') : t('Add to diary')} <Check size={16} />
          </Button>
        </form>
      )}
    </Modal>
  );
}

