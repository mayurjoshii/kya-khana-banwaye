-- Cook Assistant: starting data. Safe to re-run.
-- TODO(owner): replace the placeholder names, the cook's known dishes and the starting tastes.

insert into people (role, name, protein_min_g, protein_max_g, meal_protein_min_g, meal_protein_max_g)
values
  ('me', 'Me', 60, 70, 25, 30),           -- TODO(owner): your name
  ('partner', 'Partner', 60, 70, 25, 30)  -- TODO(owner): second person's name and target
on conflict (role) do nothing;

insert into cook_profile (id, name, visit_time, visit_minutes, max_dishes_simple, max_dishes_complex, servings, language, default_mode)
values (1, 'Cook', '12:30', 60, 4, 3, 2, 'hi-IN', 'lunch_dinner') -- TODO(owner): cook's name
on conflict (id) do nothing;

insert into cook_rules (rule, kind) values
  ('Vegetarian food plus eggs only. Never meat or fish.', 'hard'),
  ('Everything she makes is for 2 adults: lunch plus dinner, or lunch plus snacks.', 'hard'),
  ('Prefer dinner dishes that reheat well, since dinner is cooked at the 12:30 visit.', 'soft');

-- Pantry staples: counted as in stock until marked out.
insert into fridge_items (item_key, display_name, is_staple, in_stock) values
  ('atta', 'Atta', true, true),
  ('rice', 'Rice', true, true),
  ('toor dal', 'Toor dal', true, true),
  ('moong dal', 'Moong dal', true, true),
  ('masoor dal', 'Masoor dal', true, true),
  ('besan', 'Besan', true, true),
  ('oil', 'Oil', true, true),
  ('ghee', 'Ghee', true, true),
  ('onion', 'Onion', true, true),
  ('tomato', 'Tomato', true, true),
  ('ginger', 'Ginger', true, true),
  ('garlic', 'Garlic', true, true),
  ('green chilli', 'Green chilli', true, true),
  ('salt', 'Salt', true, true),
  ('sugar', 'Sugar', true, true),
  ('turmeric', 'Turmeric', true, true),
  ('red chilli powder', 'Red chilli powder', true, true),
  ('coriander powder', 'Coriander powder', true, true),
  ('cumin', 'Cumin (jeera)', true, true),
  ('mustard seeds', 'Mustard seeds', true, true),
  ('garam masala', 'Garam masala', true, true),
  ('tea', 'Tea', true, true)
on conflict (item_key) do nothing;

-- TODO(owner): replace with the 10–20 dishes the cook already makes well.
insert into cook_skills (dish_key, display_name, knows) values
  ('roti', 'Roti', true),
  ('rice', 'Rice', true),
  ('dal tadka', 'Dal tadka', true),
  ('aloo sabzi', 'Aloo sabzi', true),
  ('egg bhurji', 'Egg bhurji', true)
on conflict (dish_key) do nothing;
