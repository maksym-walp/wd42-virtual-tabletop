-- ================================================================
-- Тестові дані для локальної розробки: по 10-15 записів у кожен
-- каталог (equipment, maneuvers, abilities, artifacts, spellbook),
-- 2-3 колекції на каталог, кілька магічних традицій, пара кампаній
-- та тестові персонажі, що використовують усе вище перелічене.
--
-- Записи прив'язані до вже наявних локальних dev-акаунтів
-- (admin@mail.test / gm@mail.test / user@mail.test) — вони створюються
-- тут ідемпотентно (ON CONFLICT DO NOTHING), якщо застосувати міграцію
-- на чистій базі. Пароль для всіх трьох: DevPass123!
--
-- Лише для локального середовища — не застосовувати в проді.
-- ================================================================

DO $$
DECLARE
  v_admin UUID;
  v_gm    UUID;
  v_user  UUID;

  -- equipment.items
  e1 UUID := gen_random_uuid();  -- Довгий меч
  e2 UUID := gen_random_uuid();  -- Бойова сокира
  e3 UUID := gen_random_uuid();  -- Бойовий молот
  e4 UUID := gen_random_uuid();  -- Кинджал
  e5 UUID := gen_random_uuid();  -- Короткий лук
  e6 UUID := gen_random_uuid();  -- Набір метальних ножів
  e7 UUID := gen_random_uuid();  -- Шкіряний обладунок
  e8 UUID := gen_random_uuid();  -- Кольчуга
  e9 UUID := gen_random_uuid();  -- Латний обладунок
  e10 UUID := gen_random_uuid(); -- Дорожній заплічник
  e11 UUID := gen_random_uuid(); -- Набір польового лікаря
  e12 UUID := gen_random_uuid(); -- Альпіністська мотузка
  e13 UUID := gen_random_uuid(); -- Олійний ліхтар

  -- equipment.collections
  ec1 UUID := gen_random_uuid(); -- Спорядження мандрівника
  ec2 UUID := gen_random_uuid(); -- Арсенал ближнього бою
  ec3 UUID := gen_random_uuid(); -- Спорядження розвідника

  -- maneuvers.entries
  m1 UUID := gen_random_uuid();  -- Потужний удар
  m2 UUID := gen_random_uuid();  -- Захисна стійка
  m3 UUID := gen_random_uuid();  -- Розсічення натовпу
  m4 UUID := gen_random_uuid();  -- Провокація
  m5 UUID := gen_random_uuid();  -- Блокуючий випад
  m6 UUID := gen_random_uuid();  -- Кидок через стегно
  m7 UUID := gen_random_uuid();  -- Прицільний постріл
  m8 UUID := gen_random_uuid();  -- Щитовий штурм
  m9 UUID := gen_random_uuid();  -- Другий подих
  m10 UUID := gen_random_uuid(); -- Ланцюгова атака
  m11 UUID := gen_random_uuid(); -- Нищівний замах
  m12 UUID := gen_random_uuid(); -- Тактичний відступ

  -- maneuvers.collections
  mc1 UUID := gen_random_uuid(); -- Базові прийоми піхотинця
  mc2 UUID := gen_random_uuid(); -- Стиль важкого озброєння
  mc3 UUID := gen_random_uuid(); -- Нотатки капітана гвардії

  -- abilities.entries
  a1 UUID := gen_random_uuid();  -- Швидкі руки
  a2 UUID := gen_random_uuid();  -- Читання по губах
  a3 UUID := gen_random_uuid();  -- Гострий зір
  a4 UUID := gen_random_uuid();  -- Загартований дух
  a5 UUID := gen_random_uuid();  -- Інтуїтивне ухилення
  a6 UUID := gen_random_uuid();  -- Стійкість до отрут
  a7 UUID := gen_random_uuid();  -- Магічний резонанс
  a8 UUID := gen_random_uuid();  -- Швидке зцілення
  a9 UUID := gen_random_uuid();  -- Нічний зір
  a10 UUID := gen_random_uuid(); -- Спокій під тиском
  a11 UUID := gen_random_uuid(); -- Ритуальна пам'ять
  a12 UUID := gen_random_uuid(); -- Гострий слух

  -- abilities.collections
  ac1 UUID := gen_random_uuid(); -- Навички розвідника
  ac2 UUID := gen_random_uuid(); -- Витривалість бійця
  ac3 UUID := gen_random_uuid(); -- Особисті нотатки чарівниці

  -- artifacts.entries
  ar1 UUID := gen_random_uuid();  -- Амулет Сутінкового Ока
  ar2 UUID := gen_random_uuid();  -- Персні Вітряного Ходу
  ar3 UUID := gen_random_uuid();  -- Клинок Забутого Короля
  ar4 UUID := gen_random_uuid();  -- Плащ Тіней
  ar5 UUID := gen_random_uuid();  -- Компас Незламного Шляху
  ar6 UUID := gen_random_uuid();  -- Кристал Застиглого Часу
  ar7 UUID := gen_random_uuid();  -- Рукавиці Ковалів Безодні
  ar8 UUID := gen_random_uuid();  -- Ліхтар Заблукалих Душ
  ar9 UUID := gen_random_uuid();  -- Печатка Дому Кровавіт
  ar10 UUID := gen_random_uuid(); -- Дзеркало Двох Облич
  ar11 UUID := gen_random_uuid(); -- Флакон Сліз Фенікса
  ar12 UUID := gen_random_uuid(); -- Пояс Кам'яної Шкіри

  -- artifacts.collections
  arc1 UUID := gen_random_uuid(); -- Реліквії Архіву Архімагів
  arc2 UUID := gen_random_uuid(); -- Спадок Дому Кровавіт
  arc3 UUID := gen_random_uuid(); -- Знахідки з Руїн Ешевару

  -- spellbook.spells
  s1 UUID := gen_random_uuid();  -- Вогняна стріла
  s2 UUID := gen_random_uuid();  -- Крижаний обладунок
  s3 UUID := gen_random_uuid();  -- Зцілювальне слово
  s4 UUID := gen_random_uuid();  -- Морок Прірви
  s5 UUID := gen_random_uuid();  -- Гниль Плоті
  s6 UUID := gen_random_uuid();  -- Телепортаційний стрибок
  s7 UUID := gen_random_uuid();  -- Щит Розуму
  s8 UUID := gen_random_uuid();  -- Блискавичний удар
  s9 UUID := gen_random_uuid();  -- Прикликання Тіні
  s10 UUID := gen_random_uuid(); -- Очищення Скверни
  s11 UUID := gen_random_uuid(); -- Прокляття В'янення
  s12 UUID := gen_random_uuid(); -- Ілюзорний двійник
  s13 UUID := gen_random_uuid(); -- Кам'яна шкіра
  s14 UUID := gen_random_uuid(); -- Договір з Безоднею

  -- spellbook.collections
  sc1 UUID := gen_random_uuid(); -- Бойова магія Легіону
  sc2 UUID := gen_random_uuid(); -- Ритуали Ордену Багряного Полум'я
  sc3 UUID := gen_random_uuid(); -- Особисті нотатки чарівниці

  -- spellbook.traditions
  t1 UUID := gen_random_uuid();  -- Шлях Багряного Полум'я
  t2 UUID := gen_random_uuid();  -- Тіньова Стежка
  t3 UUID := gen_random_uuid();  -- Академія Аркани

  -- campaigns.campaigns
  camp1 UUID := gen_random_uuid(); -- Тіні Ешевару
  camp2 UUID := gen_random_uuid(); -- Спадок Дому Кровавіт
  camp3 UUID := gen_random_uuid(); -- Руїни Старого Легіону

  -- character_sheet.characters
  ch1 UUID := gen_random_uuid(); -- Кіран Вольфгарт (fighter)
  ch2 UUID := gen_random_uuid(); -- Айліт Сільвана (spellcaster)
  ch3 UUID := gen_random_uuid(); -- Ренар Тихохід (rogue)
  ch4 UUID := gen_random_uuid(); -- Брунгільда Залізна (fighter)
  ch5 UUID := gen_random_uuid(); -- Морвен Чорнокнижниця (spellcaster)
  ch6 UUID := gen_random_uuid(); -- Тайлер Спритний (rogue)

  v_char UUID;
BEGIN

  -- ── dev-акаунти (ідемпотентно) ──────────────────────────────────────────
  -- password_hash = bcrypt("DevPass123!", 12)
  INSERT INTO auth.users (email, username, password_hash, role)
  VALUES
    ('admin@mail.test', 'admin', '$2a$12$zaMFOUsomL3L97vZiLYkre6NVfJVT3C8H8fiALXJht9EXZ7chO2Zu', 'admin'),
    ('gm@mail.test',    'gmtest', '$2a$12$zaMFOUsomL3L97vZiLYkre6NVfJVT3C8H8fiALXJht9EXZ7chO2Zu', 'game_master'),
    ('user@mail.test',  'user',   '$2a$12$zaMFOUsomL3L97vZiLYkre6NVfJVT3C8H8fiALXJht9EXZ7chO2Zu', 'user')
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_admin FROM auth.users WHERE email = 'admin@mail.test';
  SELECT id INTO v_gm    FROM auth.users WHERE email = 'gm@mail.test';
  SELECT id INTO v_user  FROM auth.users WHERE email = 'user@mail.test';

  -- ── equipment.items ──────────────────────────────────────────────────────
  INSERT INTO equipment.items
    (id, user_id, name, type, damage_die, defense_value, description, is_public, price, weapon_type, weapon_grip, armor_weight, is_canonical)
  VALUES
    (e1,  v_admin, 'Довгий меч', 'weapon', 'd8', NULL, 'Класичний обосічний клинок піхотинця, збалансований для одноручного хвата.', true, 45, 'melee', 'one_handed', NULL, false),
    (e2,  v_admin, 'Бойова сокира', 'weapon', 'd10', NULL, 'Важка двостороння сокира з дубовим руків''ям, улюблена зброя гірських вояків.', true, 60, 'melee', 'two_handed', NULL, false),
    (e3,  v_gm,    'Бойовий молот', 'weapon', 'd12', NULL, 'Двобічний молот з ковальської сталі, здатний трощити щити та обладунки.', true, 80, 'melee', 'two_handed', NULL, false),
    (e4,  v_user,  'Кинджал', 'weapon', 'd4', NULL, 'Легкий клинок для швидких ударів і прихованого носіння.', true, 15, 'melee', 'one_handed', NULL, false),
    (e5,  v_gm,    'Короткий лук', 'weapon', 'd6', NULL, 'Мисливський лук з тисового дерева, зручний у лісистій місцевості.', true, 35, 'ranged', 'two_handed', NULL, false),
    (e6,  v_user,  'Набір метальних ножів', 'weapon', 'd4', NULL, 'Три збалансованих ножі для метання, носяться у наплічному чохлі.', true, 20, 'thrown', 'one_handed', NULL, false),
    (e7,  v_user,  'Шкіряний обладунок', 'armor', NULL, 2, 'Легка дублена шкіра, не сковує рухів.', true, 30, NULL, NULL, 'light', false),
    (e8,  v_admin, 'Кольчуга', 'armor', NULL, 4, 'Плетена кольчужна сорочка, стандартне спорядження піхоти.', true, 90, NULL, NULL, 'medium', false),
    (e9,  v_gm,    'Латний обладунок', 'armor', NULL, 6, 'Суцільні сталеві пластини, кують на замовлення під фігуру власника.', true, 220, NULL, NULL, 'heavy', true),
    (e10, v_user,  'Дорожній заплічник', 'item', NULL, NULL, 'Місткий заплічник з водонепроникної тканини.', true, 10, NULL, NULL, NULL, false),
    (e11, v_gm,    'Набір польового лікаря', 'item', NULL, NULL, 'Бинти, голки та трав''яні настоянки для першої допомоги.', true, 25, NULL, NULL, NULL, false),
    (e12, v_user,  'Альпіністська мотузка (15м)', 'item', NULL, NULL, 'Пенькова мотузка з гаком, витримує вагу двох людей.', true, 8, NULL, NULL, NULL, false),
    (e13, v_admin, 'Олійний ліхтар', 'item', NULL, NULL, 'Закритий ліхтар з регульованим полум''ям, години горить на одній заправці.', false, 12, NULL, NULL, NULL, false);

  INSERT INTO equipment.collections (id, user_id, name, description, is_public, is_canonical)
  VALUES
    (ec1, v_gm,    'Спорядження мандрівника', 'Базовий набір для тривалих переходів.', true, false),
    (ec2, v_admin, 'Арсенал ближнього бою', 'Зброя піхотинця для рукопашних сутичок.', true, false),
    (ec3, v_user,  'Спорядження розвідника', 'Легка броня та метальна зброя для тихих вилазок.', false, false);

  INSERT INTO equipment.collection_items (collection_id, item_id) VALUES
    (ec1, e10), (ec1, e11), (ec1, e12), (ec1, e13),
    (ec2, e1),  (ec2, e2),  (ec2, e3),  (ec2, e4),
    (ec3, e7),  (ec3, e6),  (ec3, e5);

  -- ── maneuvers.entries ────────────────────────────────────────────────────
  INSERT INTO maneuvers.entries (id, user_id, name, duration_actions, description, is_public, is_canonical)
  VALUES
    (m1,  v_admin, 'Потужний удар', 1, 'Жертвуючи точністю заради сили, боєць завдає удару з розмаху.', true, false),
    (m2,  v_admin, 'Захисна стійка', 1, 'Боєць концентрується на обороні, підвищуючи шанс блокування наступної атаки.', true, false),
    (m3,  v_gm,    'Розсічення натовпу', 2, 'Широкий замах, що зачіпає всіх ворогів у ближньому колі.', true, false),
    (m4,  v_user,  'Провокація', 1, 'Голосний виклик змушує ворога зосередитися на бійці, відволікаючи від союзників.', true, false),
    (m5,  v_admin, 'Блокуючий випад', 1, 'Одночасний випад і підняття щита для контрудару.', true, false),
    (m6,  v_gm,    'Кидок через стегно', 1, 'Захоплення супротивника з подальшим кидком на землю.', true, false),
    (m7,  v_user,  'Прицільний постріл', 2, 'Ретельно вивірений постріл, що ігнорує частину захисту цілі.', true, false),
    (m8,  v_gm,    'Щитовий штурм', 1, 'Різкий ривок зі щитом, що збиває ворога з ніг.', true, false),
    (m9,  v_admin, 'Другий подих', 2, 'Бойовий клич, що дозволяє продовжити бій попри виснаження.', true, false),
    (m10, v_gm,    'Ланцюгова атака', 3, 'Серія ударів по кількох цілях поспіль, що вимагає повної зосередженості.', true, false),
    (m11, v_user,  'Нищівний замах', 2, 'Повільний, але руйнівний удар дворучною зброєю.', false, false),
    (m12, v_admin, 'Тактичний відступ', 1, 'Контрольований відступ зі збереженням бойової стійки.', true, false);

  INSERT INTO maneuvers.collections (id, user_id, name, description, is_public, is_canonical)
  VALUES
    (mc1, v_admin, 'Базові прийоми піхотинця', 'Стартовий набір маневрів для новобранця.', true, false),
    (mc2, v_gm,    'Стиль важкого озброєння', 'Прийоми для дворучної зброї та щитів.', true, false),
    (mc3, v_user,  'Нотатки капітана гвардії', 'Особиста добірка з польових спостережень.', false, false);

  INSERT INTO maneuvers.collection_items (collection_id, maneuver_id) VALUES
    (mc1, m1), (mc1, m2), (mc1, m5), (mc1, m12),
    (mc2, m3), (mc2, m6), (mc2, m8), (mc2, m10),
    (mc3, m4), (mc3, m7), (mc3, m9), (mc3, m11);

  -- ── abilities.entries ────────────────────────────────────────────────────
  INSERT INTO abilities.entries (id, user_id, name, archetypes, description, is_public, is_canonical)
  VALUES
    (a1,  v_user,  'Швидкі руки', ARRAY['rogue'], 'Дозволяє непомітно перекласти дрібний предмет із чужої кишені чи сумки.', true, false),
    (a2,  v_user,  'Читання по губах', ARRAY['rogue'], 'Розуміння мови співрозмовника навіть без звуку, на відстані прямої видимості.', true, false),
    (a3,  v_admin, 'Гострий зір', ARRAY['fighter','rogue'], 'Помічає приховані пастки та рухи на межі видимості.', true, false),
    (a4,  v_admin, 'Загартований дух', ARRAY['fighter','spellcaster'], 'Підвищена стійкість до страху та ефектів залякування.', true, false),
    (a5,  v_gm,    'Інтуїтивне ухилення', ARRAY['rogue'], 'Рефлекторний відхід з траєкторії атаки ще до її завершення.', true, false),
    (a6,  v_gm,    'Стійкість до отрут', ARRAY['fighter'], 'Уповільнений метаболізм ослаблює дію токсинів.', true, false),
    (a7,  v_admin, 'Магічний резонанс', ARRAY['spellcaster'], 'Відчуття активних магічних ефектів у радіусі кількох кроків.', true, false),
    (a8,  v_gm,    'Швидке зцілення', ARRAY['fighter','spellcaster','rogue'], 'Прискорена регенерація дрібних ран поза бойовою сценою.', true, false),
    (a9,  v_user,  'Нічний зір', ARRAY['rogue'], 'Здатність бачити в темряві як у сутінках.', true, false),
    (a10, v_admin, 'Спокій під тиском', ARRAY['fighter'], 'Ясність мислення навіть у безвихідній ситуації бою.', true, false),
    (a11, v_gm,    'Ритуальна пам''ять', ARRAY['spellcaster'], 'Точне відтворення раз побаченого ритуалу без запису.', false, false),
    (a12, v_user,  'Гострий слух', ARRAY['rogue'], 'Вловлює кроки та шепіт крізь товщу стін.', true, false);

  INSERT INTO abilities.collections (id, user_id, name, description, is_public, is_canonical)
  VALUES
    (ac1, v_user,  'Навички розвідника', 'Добірка для персонажів, що діють непомітно.', true, false),
    (ac2, v_admin, 'Витривалість бійця', 'Здібності, що підвищують живучість у бою.', true, false),
    (ac3, v_gm,    'Особисті нотатки чарівниці', 'Здібності, зібрані під час мандрів з учнями.', false, false);

  INSERT INTO abilities.collection_items (collection_id, ability_id) VALUES
    (ac1, a1), (ac1, a2), (ac1, a9), (ac1, a12),
    (ac2, a3), (ac2, a4), (ac2, a6), (ac2, a10),
    (ac3, a5), (ac3, a7), (ac3, a8), (ac3, a11);

  -- ── artifacts.entries ────────────────────────────────────────────────────
  INSERT INTO artifacts.entries (id, user_id, name, description, is_public, price, creator, rarity, is_canonical)
  VALUES
    (ar1,  v_admin, 'Амулет Сутінкового Ока', 'Дозволяє власнику бачити магічні сліди, залишені менше доби тому.', true, 850, 'Архімаг Северин', 'rare', false),
    (ar2,  v_admin, 'Персні Вітряного Ходу', 'Пара кілець, що на коротку мить дарують легкість кроку вітру.', true, 320, 'Невідомий майстер Аренкурту', 'uncommon', false),
    (ar3,  v_gm,    'Клинок Забутого Короля', 'Меч, викуваний для останнього короля Ешевару, ще пам''ятає присягу.', true, 4200, 'Король Альдрік Третій', 'legendary', true),
    (ar4,  v_user,  'Плащ Тіней', 'Тканина поглинає світло смолоскипів у радіусі кроку.', true, 600, 'Гільдія Нічних Кравців', 'rare', false),
    (ar5,  v_user,  'Компас Незламного Шляху', 'Стрілка завжди вказує на найкоротший безпечний шлях додому.', true, 150, NULL, 'common', false),
    (ar6,  v_admin, 'Кристал Застиглого Часу', 'Здатний на кілька секунд сповільнити перебіг подій навколо власника.', true, 5000, 'Орден Багряного Полум''я', 'legendary', false),
    (ar7,  v_gm,    'Рукавиці Ковалів Безодні', 'Дозволяють голіруч тримати розпечений метал без опіків.', true, 400, 'Ковалі Безодні', 'uncommon', false),
    (ar8,  v_admin, 'Ліхтар Заблукалих Душ', 'Полум''я горить синім поруч із неспокійними духами.', true, 700, 'Архімаг Северин', 'rare', false),
    (ar9,  v_gm,    'Печатка Дому Кровавіт', 'Родовий перстень-печатка, що відкриває приховані двері маєтку.', true, 200, 'Дім Кровавіт', 'common', false),
    (ar10, v_user,  'Дзеркало Двох Облич', 'Показує не відображення, а справжні наміри того, хто дивиться.', false, 1100, 'Культ Порожнечі', 'rare', false),
    (ar11, v_admin, 'Флакон Сліз Фенікса', 'Єдина крапля здатна зцілити смертельну рану.', true, 3500, NULL, 'legendary', false),
    (ar12, v_gm,    'Пояс Кам''яної Шкіри', 'Тимчасово перетворює шкіру власника на подобу каменю.', true, 550, 'Ковалі Безодні', 'uncommon', false);

  INSERT INTO artifacts.collections (id, user_id, name, description, is_public, is_canonical)
  VALUES
    (arc1, v_admin, 'Реліквії Архіву Архімагів', 'Предмети, зібрані Архівом для вивчення.', true, false),
    (arc2, v_gm,    'Спадок Дому Кровавіт', 'Родинні реліквії, що передаються у спадок.', true, false),
    (arc3, v_user,  'Знахідки з Руїн Ешевару', 'Особиста колекція трофеїв з останньої експедиції.', false, false);

  INSERT INTO artifacts.collection_items (collection_id, artifact_id) VALUES
    (arc1, ar1), (arc1, ar6), (arc1, ar8), (arc1, ar11),
    (arc2, ar3), (arc2, ar9), (arc2, ar12),
    (arc3, ar4), (arc3, ar5), (arc3, ar10);

  -- ── spellbook.spells ─────────────────────────────────────────────────────
  INSERT INTO spellbook.spells
    (id, user_id, name, mechanical_desc, narrative_desc, energy_cost, action_time, ritual,
     duration_value, duration_unit, range_desc, is_public, spell_kind, nature, lore_creator, components, is_canonical)
  VALUES
    (s1, v_admin, 'Вогняна стріла',
     'Завдає 2к6 вогняного урону цілі в межах дальності.',
     'З кінчиків пальців зривається вузький сніп полум''я.',
     3, 1, 'impossible', NULL, 'instant', '18 метрів', true, 'ranged',
     ARRAY['elemental'], NULL,
     jsonb_build_array(jsonb_build_object('item_id', NULL, 'name', 'щіпка сірки', 'quantity', 1, 'unit', 'щіпка')), false),

    (s2, v_admin, 'Крижаний обладунок',
     '+2 до пасивного захисту; ворог, що влучив ближнім боєм, отримує 1к4 холодного урону.',
     'Тонка крижана кірка вкриває шкіру заклинача.',
     4, 1, 'impossible', 3, 'minutes', 'на себе', true, 'defensive',
     ARRAY['elemental'], 'Орден Крижаного Кола', '[]'::jsonb, false),

    (s3, v_gm, 'Зцілювальне слово',
     'Ціль відновлює 2к4+2 здоров''я.',
     'Тихе слово рідною мовою серця лікує рану швидше за час.',
     3, 1, 'impossible', NULL, 'instant', '9 метрів', true, 'healing',
     ARRAY['integral'], NULL, '[]'::jsonb, false),

    (s4, v_gm, 'Морок Прірви',
     'Завдає 3к6 урону тьмою; ціль на раунд втрачає периферійний зір.',
     'Морок стискається у чорний спис і летить до цілі.',
     5, 2, 'impossible', NULL, 'instant', '12 метрів', true, 'ranged',
     ARRAY['infernal'], 'Культ Порожнечі',
     jsonb_build_array(jsonb_build_object('item_id', NULL, 'name', 'попіл спаленої кістки', 'quantity', 1, 'unit', 'дрібка')), false),

    (s5, v_user, 'Гниль Плоті',
     'Ціль отримує 1к6 урону одразу і ще 1к4 щодня протягом тривалості.',
     'Дотик заклинача залишає на шкірі цілі сіру пляму гниття.',
     4, 1, 'impossible', 2, 'days', 'дотик', false, 'melee',
     ARRAY['blight'], NULL, '[]'::jsonb, false),

    (s6, v_admin, 'Телепортаційний стрибок',
     'Заклинач миттєво переміщується у видиму точку в межах дальності.',
     'Простір на мить згортається, наче аркуш паперу.',
     6, 1, 'impossible', NULL, 'instant', '15 метрів у межах прямої видимості', true, 'utility',
     ARRAY['arcana'], 'Академія Аркани', '[]'::jsonb, true),

    (s7, v_admin, 'Щит Розуму',
     'Дає імунітет до одного ефекту читання/впливу на розум протягом тривалості.',
     'Навколо думок заклинача вибудовується непроникна стіна.',
     3, 1, 'impossible', 1, 'hours', 'на себе', true, 'defensive',
     ARRAY['arcana'], 'Академія Аркани', '[]'::jsonb, true),

    (s8, v_gm, 'Блискавичний удар',
     'Завдає 2к8 урону електрикою; зброя заклинача на мить спалахує іскрами.',
     'Розряд пробігає по клинку в момент удару.',
     5, 1, 'impossible', NULL, 'instant', 'дотик', true, 'melee',
     ARRAY['elemental'], 'Гільдія Грозового Клинка',
     jsonb_build_array(jsonb_build_object('item_id', e4, 'name', 'заряджений кинджал', 'quantity', 1, 'unit', 'шт.')), false),

    (s9, v_gm, 'Прикликання Тіні',
     'Прикликає тіньового союзника, що діє за командою заклинача до кінця тривалості.',
     'З-під землі здіймається постать, зіткана з темряви.',
     7, 3, 'possible', 1, 'hours', '6 метрів', true, 'combined',
     ARRAY['infernal'], 'Культ Порожнечі',
     jsonb_build_array(jsonb_build_object('item_id', NULL, 'name', 'чорна свічка', 'quantity', 3, 'unit', 'шт.')), false),

    (s10, v_user, 'Очищення Скверни',
     'Знімає один негативний магічний ефект з цілі.',
     'Тепле сяйво змиває чужорідну магію, наче воду з каменю.',
     4, 2, 'impossible', NULL, 'instant', '3 метри', true, 'utility',
     ARRAY['integral'], NULL, '[]'::jsonb, false),

    (s11, v_user, 'Прокляття В''янення',
     'Ціль отримує штраф -2 до Витривалості на тривалість прокляття.',
     'Квіти в''януть, коли прокляття лягає на плечі жертви.',
     5, 2, 'impossible', 5, 'days', '10 метрів', false, 'ranged',
     ARRAY['blight'], NULL, '[]'::jsonb, false),

    (s12, v_admin, 'Ілюзорний двійник',
     'Створює візуальну копію заклинача, що повторює прості рухи.',
     'Повітря мерехтить, і поруч постає точна копія чарівниці.',
     4, 1, 'impossible', 3, 'minutes', 'на себе', true, 'utility',
     ARRAY['arcana'], 'Академія Аркани', '[]'::jsonb, true),

    (s13, v_gm, 'Кам''яна шкіра',
     '+3 до пасивного захисту; швидкість пересування знижена вдвічі.',
     'Шкіра заклинача береться сірим кам''яним візерунком.',
     5, 1, 'impossible', 2, 'minutes', 'на себе', true, 'defensive',
     ARRAY['elemental','integral'], NULL, '[]'::jsonb, false),

    (s14, v_gm, 'Договір з Безоднею',
     'Заклинач отримує тимчасову силу ціною частини максимального здоров''я до кінця сесії.',
     'Угода скріплюється кров''ю на лезі ритуального кинджала.',
     9, 3, 'required', NULL, 'permanent', 'дотик', false, 'combined',
     ARRAY['infernal','blight'], 'Культ Порожнечі',
     jsonb_build_array(
       jsonb_build_object('item_id', e4, 'name', 'ритуальний кинджал', 'quantity', 1, 'unit', 'шт.'),
       jsonb_build_object('item_id', NULL, 'name', 'власна кров', 'quantity', 1, 'unit', 'крапля')
     ), false);

  INSERT INTO spellbook.collections (id, user_id, name, description, is_public, is_canonical)
  VALUES
    (sc1, v_admin, 'Бойова магія Легіону', 'Заклинання, стандартні для бойових магів Легіону.', true, false),
    (sc2, v_admin, 'Ритуали Ордену Багряного Полум''я', 'Захисні та переміщувальні заклинання ордену.', true, false),
    (sc3, v_gm,    'Особисті нотатки чарівниці', 'Заклинання, вивчені під час мандрів поза академією.', false, false);

  INSERT INTO spellbook.collection_items (collection_id, spell_id) VALUES
    (sc1, s1), (sc1, s4), (sc1, s8), (sc1, s9),
    (sc2, s2), (sc2, s6), (sc2, s7), (sc2, s13),
    (sc3, s3), (sc3, s5), (sc3, s10), (sc3, s11), (sc3, s12), (sc3, s14);

  -- ── spellbook.traditions ─────────────────────────────────────────────────
  INSERT INTO spellbook.traditions (id, name, description, founders, creator_id)
  VALUES
    (t1, 'Шлях Багряного Полум''я', 'Традиція, що зосереджена на керуванні вогнем і жаром як проявом волі.', 'Орден Багряного Полум''я', v_admin),
    (t2, 'Тіньова Стежка', 'Заборонена традиція роботи з тьмою, недугою та забуттям.', 'Культ Порожнечі', v_gm),
    (t3, 'Академія Аркани', 'Академічна традиція точних, вивірених формул простору й розуму.', 'Архімаг Северин', v_admin);

  INSERT INTO spellbook.tradition_spells (tradition_id, spell_id) VALUES
    (t1, s1), (t1, s2), (t1, s8), (t1, s13),
    (t2, s4), (t2, s9), (t2, s11), (t2, s14),
    (t3, s6), (t3, s7), (t3, s10), (t3, s12);

  -- ── campaigns.campaigns ──────────────────────────────────────────────────
  INSERT INTO campaigns.campaigns (id, gm_id, name, invite_code, shared_notes, gm_notes)
  VALUES
    (camp1, v_gm,    'Тіні Ешевару', 'ESHV-7X2Q', 'Група розслідує зникнення торгового каравану на околицях Ешевару.', 'Головний антагоніст - культист Тіньової Стежки, розкрити у 3 сесії.'),
    (camp2, v_admin, 'Спадок Дому Кровавіт', 'KRVT-4M9L', 'Гравці втягнуті у спадкову суперечку шляхетного дому.', 'Справжній спадкоємець - НПЦ, введений на сесії 5.'),
    (camp3, v_gm,    'Руїни Старого Легіону', 'LEGN-1P8R', 'Дослідження покинутого форту на кордоні.', 'У підземеллі форту - прикликана Тінь (s9), тримати як фінального боса.');

  -- ── character_sheet.characters ───────────────────────────────────────────
  INSERT INTO character_sheet.characters
    (id, user_id, name, archetype, race, race_ancestry, is_public, backstory, notes,
     current_hp, current_magic, dev_points, health_dice_values, conditions, money,
     defense_bonus, luck_current, luck_max, rogue_inspiration_die, rogue_inspiration_given_to, spell_bonus)
  VALUES
    (ch1, v_user, 'Кіран Вольфгарт', 'fighter', 'human', NULL, true,
     'Колишній вартовий прикордонного форту, що подався найманцем після розпуску залоги.',
     'Носить на щиті герб свого старого підрозділу.',
     18, 0, 5, ARRAY[6,5,7,8], '[]'::jsonb, jsonb_build_object('gold', 40, 'silver', 12),
     1, 0, 0, NULL, NULL, 0),

    (ch2, v_user, 'Айліт Сільвана', 'spellcaster', 'elf', NULL, true,
     'Випускниця Академії Аркани, що прагне довести цінність теоретичної магії у польових умовах.',
     'Веде польовий щоденник спостережень за просторовими аномаліями.',
     12, 20, 6, '{}'::integer[], '[]'::jsonb, jsonb_build_object('gold', 55, 'silver', 3),
     0, 0, 0, NULL, NULL, 1),

    (ch3, v_gm, 'Ренар Тихохід', 'rogue', 'gnome', NULL, true,
     'Колишній контрабандист, що виплачує старий борг гільдії розвідувальними завданнями.',
     'Ніколи не розлучається з парою метальних ножів.',
     10, 0, 4, ARRAY[4,5], '[]'::jsonb, jsonb_build_object('gold', 70, 'silver', 25),
     0, 2, 3, 'd6', 'Айліт Сільвана', 0),

    (ch4, v_admin, 'Брунгільда Залізна', 'fighter', 'dwarf', NULL, true,
     'Ковалиха-войовниця з гірського клану, що приєдналася до загону заради помсти работоргівцям.',
     'Обладунок кований власноруч і досі не завершений.',
     22, 0, 5, ARRAY[7,8,6,7], jsonb_build_array(jsonb_build_object('type', 'injury', 'level', 1)), jsonb_build_object('gold', 30, 'silver', 5),
     2, 0, 0, NULL, NULL, 0),

    (ch5, v_gm, 'Морвен Чорнокнижниця', 'spellcaster', 'sangvi', NULL, false,
     'Практикує заборонену традицію Тіньової Стежки далеко від очей Академії.',
     'Приховує від супутників справжнє джерело своєї сили.',
     11, 18, 6, '{}'::integer[], '[]'::jsonb, jsonb_build_object('gold', 90, 'silver', 0),
     0, 0, 0, NULL, NULL, 2),

    (ch6, v_admin, 'Тайлер Спритний', 'rogue', 'nephilim', 'human', true,
     'Напівкровний нащадок роду з небесним корінням, що приховує походження серед людей.',
     'Крила ховає під плащем, показує лише найближчим союзникам.',
     13, 4, 4, ARRAY[5,5], '[]'::jsonb, jsonb_build_object('gold', 25, 'silver', 40),
     0, 1, 2, NULL, NULL, 0);

  -- ── character_sheet.skills (усі 20 навичок на базовому 1, потім бонуси) ─
  FOREACH v_char IN ARRAY ARRAY[ch1, ch2, ch3, ch4, ch5, ch6] LOOP
    INSERT INTO character_sheet.skills (character_id, skill_key, value)
    SELECT v_char, k, 1
    FROM unnest(ARRAY[
      'evasion','acrobatics','stealth','sleight_of_hand',
      'strength','immunity','magic_sense','endurance',
      'history','nature','erudition','mysticism',
      'intuition','spellcasting','cleverness','perception',
      'will','deception','artistry','persuasion'
    ]) AS k
    ON CONFLICT (character_id, skill_key) DO NOTHING;
  END LOOP;

  UPDATE character_sheet.skills SET value = 4, progress_marks = 2 WHERE character_id = ch1 AND skill_key = 'strength';
  UPDATE character_sheet.skills SET value = 3, progress_marks = 1 WHERE character_id = ch1 AND skill_key = 'endurance';
  UPDATE character_sheet.skills SET value = 2 WHERE character_id = ch1 AND skill_key = 'evasion';

  UPDATE character_sheet.skills SET value = 5, progress_marks = 3 WHERE character_id = ch2 AND skill_key = 'mysticism';
  UPDATE character_sheet.skills SET value = 4, progress_marks = 2 WHERE character_id = ch2 AND skill_key = 'spellcasting';
  UPDATE character_sheet.skills SET value = 3 WHERE character_id = ch2 AND skill_key = 'erudition';

  UPDATE character_sheet.skills SET value = 4, progress_marks = 2 WHERE character_id = ch3 AND skill_key = 'stealth';
  UPDATE character_sheet.skills SET value = 4, progress_marks = 1 WHERE character_id = ch3 AND skill_key = 'sleight_of_hand';
  UPDATE character_sheet.skills SET value = 3 WHERE character_id = ch3 AND skill_key = 'acrobatics';

  UPDATE character_sheet.skills SET value = 5, progress_marks = 3 WHERE character_id = ch4 AND skill_key = 'strength';
  UPDATE character_sheet.skills SET value = 4, progress_marks = 1 WHERE character_id = ch4 AND skill_key = 'endurance';

  UPDATE character_sheet.skills SET value = 4, progress_marks = 2 WHERE character_id = ch5 AND skill_key = 'mysticism';
  UPDATE character_sheet.skills SET value = 3 WHERE character_id = ch5 AND skill_key = 'will';

  UPDATE character_sheet.skills SET value = 4, progress_marks = 1 WHERE character_id = ch6 AND skill_key = 'stealth';
  UPDATE character_sheet.skills SET value = 3 WHERE character_id = ch6 AND skill_key = 'perception';

  -- ── character_sheet.tree_progress (авто-розблокування кореневих вузлів) ─
  INSERT INTO character_sheet.tree_progress (character_id, node_id)
  SELECT ch1, n.id FROM skill_tree.nodes n
  WHERE n.is_root = true
    AND (array_length(n.archetypes, 1) IS NULL OR 'fighter' = ANY(n.archetypes))
    AND (array_length(n.races, 1) IS NULL OR 'human' = ANY(n.races))
  ON CONFLICT (character_id, node_id) DO NOTHING;

  INSERT INTO character_sheet.tree_progress (character_id, node_id)
  SELECT ch2, n.id FROM skill_tree.nodes n
  WHERE n.is_root = true
    AND (array_length(n.archetypes, 1) IS NULL OR 'spellcaster' = ANY(n.archetypes))
    AND (array_length(n.races, 1) IS NULL OR 'elf' = ANY(n.races))
  ON CONFLICT (character_id, node_id) DO NOTHING;

  INSERT INTO character_sheet.tree_progress (character_id, node_id)
  SELECT ch3, n.id FROM skill_tree.nodes n
  WHERE n.is_root = true
    AND (array_length(n.archetypes, 1) IS NULL OR 'rogue' = ANY(n.archetypes))
    AND (array_length(n.races, 1) IS NULL OR 'gnome' = ANY(n.races))
  ON CONFLICT (character_id, node_id) DO NOTHING;

  INSERT INTO character_sheet.tree_progress (character_id, node_id)
  SELECT ch4, n.id FROM skill_tree.nodes n
  WHERE n.is_root = true
    AND (array_length(n.archetypes, 1) IS NULL OR 'fighter' = ANY(n.archetypes))
    AND (array_length(n.races, 1) IS NULL OR 'dwarf' = ANY(n.races))
  ON CONFLICT (character_id, node_id) DO NOTHING;

  INSERT INTO character_sheet.tree_progress (character_id, node_id)
  SELECT ch5, n.id FROM skill_tree.nodes n
  WHERE n.is_root = true
    AND (array_length(n.archetypes, 1) IS NULL OR 'spellcaster' = ANY(n.archetypes))
    AND (array_length(n.races, 1) IS NULL OR 'sangvi' = ANY(n.races))
  ON CONFLICT (character_id, node_id) DO NOTHING;

  INSERT INTO character_sheet.tree_progress (character_id, node_id)
  SELECT ch6, n.id FROM skill_tree.nodes n
  WHERE n.is_root = true
    AND (array_length(n.archetypes, 1) IS NULL OR 'rogue' = ANY(n.archetypes))
    AND (array_length(n.races, 1) IS NULL OR 'nephilim' = ANY(n.races))
  ON CONFLICT (character_id, node_id) DO NOTHING;

  -- ── character_sheet.equipment / .maneuvers / .abilities / .known_spells ─
  INSERT INTO character_sheet.equipment (character_id, equipment_id, mastery_count, mastered) VALUES
    (ch1, e1, 2, false), (ch1, e8, 0, false),
    (ch2, e4, 0, false),
    (ch3, e5, 1, false), (ch3, e6, 3, true), (ch3, e7, 0, false),
    (ch4, e2, 3, true),  (ch4, e9, 0, false),
    (ch6, e6, 1, false), (ch6, e10, 0, false);

  INSERT INTO character_sheet.maneuvers (character_id, maneuver_id) VALUES
    (ch1, m1), (ch1, m5), (ch1, m12),
    (ch4, m3), (ch4, m6), (ch4, m8), (ch4, m10);

  INSERT INTO character_sheet.abilities (character_id, ability_id) VALUES
    (ch1, a3), (ch1, a10),
    (ch2, a4), (ch2, a7),
    (ch3, a1), (ch3, a2), (ch3, a9), (ch3, a12),
    (ch4, a6), (ch4, a10),
    (ch5, a7), (ch5, a11),
    (ch6, a1), (ch6, a5), (ch6, a9);

  INSERT INTO character_sheet.known_spells (character_id, spell_id, mastered, cast_count) VALUES
    (ch2, s6, true, 2), (ch2, s7, false, 1), (ch2, s12, false, 0),
    (ch5, s4, true, 3), (ch5, s9, false, 1), (ch5, s14, false, 0);

  -- ── campaigns.campaign_characters ────────────────────────────────────────
  INSERT INTO campaigns.campaign_characters (campaign_id, character_id) VALUES
    (camp1, ch1), (camp1, ch2), (camp1, ch3),
    (camp2, ch4), (camp2, ch6),
    (camp3, ch5);

END $$;
