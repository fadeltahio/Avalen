import {test,expect} from '@playwright/test';
async function demo(page){await page.goto('/');await page.getByRole('button',{name:'Explore demo'}).click();await expect(page.getByRole('heading',{name:/Make it count,/})).toBeVisible();}
const state=page=>page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('avalen.workspace.v1'));const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;return {client:d.clients.find(c=>c.id===d.activeClientId),foods:d.foodLogs,active:d.activeClientId,totalCalories:d.foodLogs.filter(f=>f.clientId===d.activeClientId&&f.date===today).reduce((n,f)=>n+f.kcal,0)};});
const nav=(page,name)=>page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true});
const ringValue=page=>page.locator('.home-macro').first().locator('.home-macro-ring b');

test('home has real coach targets, direct nutrition access and matching campaign imagery',async({page})=>{
 await demo(page);
 const s=await state(page);
 await expect(page.getByRole('region',{name:'Today’s nutrition'})).toBeVisible();
 await expect(page.locator('.home-macro')).toHaveCount(4);
 await expect(page.locator('.home-macro').first()).toContainText(`of ${s.client.nutrition.kcal.toLocaleString()}`);
 await expect(page.getByRole('button',{name:'Open coach meal plan'})).toContainText('YOUR COACH’S MEAL');
 await expect(page.locator('.home-today-session img')).toHaveAttribute('src','/design/campaign-strength-v2.webp');
 await expect(page.locator('.editorial-session-photo img').first()).toHaveAttribute('src',/cover-lower-strength/);
 await nav(page,'Nutrition').click();
 await page.locator('.nutrition-plan-disclosure > summary').click();
 await expect(page.getByRole('region',{name:'Coach nutrition plan'})).toBeVisible();
 for(const meal of s.client.nutrition.meals) await expect(page.getByRole('heading',{name:meal.description,exact:true})).toBeVisible();
});

test('coach meal plan changes reach home and a client can log the eaten portion',async({page})=>{
 await demo(page);const baseline=(await state(page)).totalCalories;
 await page.getByLabel('Workspace role').selectOption('coach');
 await nav(page,'Clients').click();
 await page.getByRole('button').filter({has:page.getByRole('heading',{name:'Jordan Williams',exact:true})}).click();
 await page.getByRole('tab',{name:'Nutrition',exact:true}).click();
 await page.getByLabel('Approach').selectOption('Structured');
 await page.getByLabel('Calories',{exact:true}).fill('2700');
 await page.getByLabel('Meal guidance',{exact:true}).first().fill('Eggs, toast and fruit');
 await page.getByLabel('Meal calories',{exact:true}).first().fill('640');
 await page.getByLabel('Meal protein (g)',{exact:true}).first().fill('42');
 await page.getByLabel('Meal carbs (g)',{exact:true}).first().fill('71');
 await page.getByLabel('Meal fat (g)',{exact:true}).first().fill('20');
 await page.getByLabel('Why are you making this change?').fill('Updated meals for the training block.');
 await page.getByRole('button',{name:'Save nutrition plan'}).click();
 await page.getByLabel('Workspace role').selectOption('client');
 await expect(page.locator('.home-macro').first()).toContainText('2,700');
 await expect(page.getByRole('button',{name:'Open coach meal plan'})).toContainText('YOUR COACH’S MEAL PLAN');
 await nav(page,'Nutrition').click();
 await page.locator('.nutrition-plan-disclosure > summary').click();
 await page.getByRole('button',{name:'Log planned Breakfast',exact:true}).click();
 await page.getByRole('button',{name:/0\.5×/}).click();
 await expect(page.getByLabel('Calories (kcal)',{exact:true})).toHaveValue('320');
 await expect(page.getByLabel('Protein (g)',{exact:true})).toHaveValue('21');
 await page.getByRole('button',{name:'Log meal',exact:true}).click();
 const s=await state(page);const log=s.foods.at(-1);
 expect(log).toMatchObject({name:'Eggs, toast and fruit',kcal:320,p:21,source:'coach-plan',confirmed:true});
 await nav(page,'Home').click();
 await expect(ringValue(page)).toContainText((baseline+320).toLocaleString());
 await page.reload();await expect(ringValue(page)).toContainText((baseline+320).toLocaleString());
});

test('photo upload reviews coach food and portion before updating calories and rings',async({page})=>{
 await demo(page);const before=await state(page);const initialCount=before.foods.length;
 await page.getByRole('button',{name:'Photo meal',exact:true}).click();
 await expect(page.getByText('Photo recognition',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Review meal',exact:true})).toBeDisabled();
 await page.getByLabel('Upload meal photo',{exact:true}).setInputFiles('public/design/meal-olive.webp');
 await expect(page.getByAltText('Your meal photo',{exact:true})).toBeVisible();
 expect((await state(page)).foods).toHaveLength(initialCount);
 await page.getByRole('button',{name:'Review meal',exact:true}).click();
 await page.getByLabel('Match your meal',{exact:true}).selectOption('plan:1');
 await page.getByRole('button',{name:/1\.5×/}).click();
 await expect(page.getByLabel('Calories (kcal)',{exact:true})).toHaveValue('1125');
 await page.getByRole('button',{name:'Log meal',exact:true}).click();
 const after=await state(page);const log=after.foods.at(-1);
 expect(after.foods).toHaveLength(initialCount+1);
 expect(log).toMatchObject({source:'photo-coach-plan',kcal:1125,confirmed:true,meal:'Lunch'});expect(log.photo.id).toBeTruthy();
 await expect(ringValue(page)).toContainText((before.totalCalories+1125).toLocaleString());
 await page.reload();await expect(ringValue(page)).toContainText((before.totalCalories+1125).toLocaleString());
 await nav(page,'Nutrition').click();
 const proteinRing=page.locator('.ring-item.macro-protein');const protein=Number((await proteinRing.getAttribute('aria-label')).match(/Protein: ([\d.]+)/)[1]);await expect(proteinRing.locator('.ring b')).toHaveText(`${protein.toLocaleString()}g`);
 await page.getByRole('button').filter({hasText:'Chicken, rice & vegetables'}).click();
 await expect(page.getByAltText('Chicken, rice & vegetables',{exact:true})).toBeVisible();
});

test('manual values remain editable and missing macros stay unknown',async({page})=>{
 await demo(page);
 await page.getByRole('button',{name:'Photo meal',exact:true}).click();
 await page.getByLabel('Upload meal photo',{exact:true}).setInputFiles('public/design/meal-olive.webp');
 await page.getByRole('button',{name:'Review meal',exact:true}).click();
 await page.getByLabel('Meal name',{exact:true}).fill('Lunch bowl');
 await page.getByLabel('Calories (kcal)',{exact:true}).fill('480');
 await page.getByRole('button',{name:'Log meal',exact:true}).click();
 const log=(await state(page)).foods.at(-1);
 expect(log).toMatchObject({kcal:480,p:null,c:null,f:null,source:'photo-manual',missingMacros:['p','c','f']});
 await expect(page.getByText('Some logged meals still need macro values.')).toBeVisible();
});
