import time
import json
import urllib.request
import psycopg2
from faker import Faker
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

SITE_URL = "http://web-app:3000"
fake = Faker("ru_RU")



person = {
    "lastName": fake.last_name_male(),
    "firstName": fake.first_name_male(),
    "middleName": fake.middle_name_male(),
    "birthPlace": fake.city_name(),
    "birthDate": fake.date_of_birth(minimum_age=18, maximum_age=60).isoformat(),
    "passportSeries": str(fake.random_int(1000, 3999)),
    "passportNumber": fake.numerify("######"),
    "issueDate": fake.date_between(start_date="-5y", end_date="today").isoformat(),
    "divisionCode": fake.numerify("###-###"),
    "issuedBy": f"Отдел МВД России по г. {fake.city_name()}",
    "phone": "+7" + fake.numerify("##########"),
}
print("Данные для теста (Faker):", json.dumps(person, ensure_ascii=False))


def set_date(element, value):
    driver.execute_script("""
        const element = arguments[0];
        const value = arguments[1];
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        ).set;
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    """, element, value)


DB_CONFIG = {
    "host": "postgres", "port": 5432, "database": "form",
    "user": "postgres", "password": "postgres",
}


conn = None
for attempt in range(30):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        break
    except psycopg2.OperationalError:
        print(f"Ожидание PostgreSQL... попытка {attempt + 1}/30")
        time.sleep(2)
if conn is None:
    raise RuntimeError("Не удалось подключиться к PostgreSQL")

cursor = conn.cursor()
cursor.execute("SELECT COUNT(*), MIN(id), MAX(id) FROM requests")
count, min_id, max_id = cursor.fetchone()
assert count == 1001, f"Ожидалось ровно 1001 начальная запись, найдено {count}"
assert min_id == 1 and max_id == 1001, f"Неверный диапазон ID: {min_id}..{max_id}"
cursor.execute("SELECT id FROM requests ORDER BY id")
assert [row[0] for row in cursor.fetchall()] == list(range(1, 1002)), \
    "ID должны идти последовательно от 1 до 1001"
cursor.close()
conn.close()


options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1280,1000")
driver = webdriver.Chrome(options=options)
try:
    wait = WebDriverWait(driver, 20)
    for attempt in range(30):
        try:
            driver.get(SITE_URL)
            wait.until(EC.presence_of_element_located((By.NAME, "lastName")))
            break
        except Exception:
            if attempt == 29:
                raise
            time.sleep(2)

    assert driver.find_elements(By.NAME, "lastName"), "Нет поля фамилии"
    assert driver.find_elements(By.NAME, "firstName"), "Нет поля имени"
    assert driver.find_elements(By.NAME, "middleName"), "Нет поля отчества"
    assert driver.find_elements(By.NAME, "birthPlace"), "Нет поля места рождения"
    assert driver.find_elements(By.NAME, "birthDate"), "Нет поля даты рождения"
    assert driver.find_elements(By.NAME, "gender"), "Нет поля пола"
    assert not driver.find_elements(By.NAME, "message"), "Поле сообщения не должно присутствовать"
    for removed_field in ["email", "registration", "actualAddress"]:
        assert not driver.find_elements(By.NAME, removed_field), f"Поле {removed_field} должно быть удалено"
    for field in ["passportSeries", "passportNumber", "issueDate", "divisionCode", "issuedBy"]:
        assert driver.find_elements(By.NAME, field), f"Нет паспортного поля {field}"

    driver.find_element(By.NAME, "lastName").send_keys(person["lastName"])
    driver.find_element(By.NAME, "firstName").send_keys(person["firstName"])
    driver.find_element(By.NAME, "middleName").send_keys(person["middleName"])
    driver.find_element(By.NAME, "birthPlace").send_keys(person["birthPlace"])
    set_date(driver.find_element(By.NAME, "birthDate"), person["birthDate"])
    Select(driver.find_element(By.NAME, "gender")).select_by_visible_text("Мужской")
    driver.find_element(By.NAME, "passportSeries").send_keys(person["passportSeries"])
    driver.find_element(By.NAME, "passportNumber").send_keys(person["passportNumber"])
    set_date(driver.find_element(By.NAME, "issueDate"), person["issueDate"])
    driver.find_element(By.NAME, "divisionCode").send_keys(person["divisionCode"])
    driver.find_element(By.NAME, "issuedBy").send_keys(person["issuedBy"])
    driver.find_element(By.NAME, "phone").send_keys(person["phone"])
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

    status = wait.until(EC.text_to_be_present_in_element((By.ID, "status"), "ID заявки: 1002"))
    assert status, "Новая анкета должна получить ID 1002"
finally:
    driver.quit()

api_item = None
for attempt in range(30):
    try:
        with urllib.request.urlopen(f"{SITE_URL}/api/guess/item?id=777", timeout=5) as response:
            assert response.status == 200
            api_item = json.loads(response.read().decode("utf-8"))
            break
    except Exception:
        if attempt == 29:
            raise
        time.sleep(2)
assert api_item["id"] == 777, "API бинарного поиска не вернул ID 777"


with urllib.request.urlopen(f"{SITE_URL}/api/guess/item?id=777", timeout=5) as response:
    assert response.headers.get("X-Cache") == "HIT", "Повторный запрос ID 777 должен прийти из Redis"
    assert json.loads(response.read().decode("utf-8"))["id"] == 777
print("Redis кэш работает: повторный запрос ID 777 -> X-Cache: HIT")

conn = psycopg2.connect(**DB_CONFIG)
cursor = conn.cursor()
cursor.execute("SELECT id, last_name, first_name, middle_name FROM requests WHERE id = 1002")
created = cursor.fetchone()
assert created == (1002, person["lastName"], person["firstName"], person["middleName"]), "Анкета 1002 не сохранена с раздельными именами"
cursor.execute("SELECT request_id, passport_series, passport_number, division_code FROM passports WHERE request_id = 1002")
passport = cursor.fetchone()
assert passport == (1002, person["passportSeries"], person["passportNumber"], person["divisionCode"]), "Паспортные данные не связаны с анкетой 1002"
cursor.execute("SELECT COUNT(*) FROM passports")
assert cursor.fetchone()[0] == 1002, "Для каждой анкеты должна быть связанная паспортная запись"
cursor.close()
conn.close()


def submit_minimal_request(data):
    request = urllib.request.Request(
        f"{SITE_URL}/requests",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        assert response.status == 201
        return json.loads(response.read().decode("utf-8"))


phone_match = submit_minimal_request({"phone": person["phone"]})
assert phone_match["id"] == 1003, "Phone-only request should be saved as ID 1003"
assert phone_match["personId"] == 1002, "Phone-only request should match person 1002"

conn = psycopg2.connect(**DB_CONFIG)
cursor = conn.cursor()
cursor.execute("SELECT id, person_id, phone FROM requests WHERE id = 1003")
assert cursor.fetchone() == (1003, 1002, person["phone"]), "Телефон должен сохраниться и связать обращение с человеком 1002"
cursor.execute("SELECT COUNT(*) FROM passports")
assert cursor.fetchone()[0] == 1002, "Запрос только с телефоном не должен создавать паспортную запись"
cursor.execute("""
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'requests' AND column_name = 'email')
        OR (table_name = 'passports' AND column_name IN ('registration', 'actual_address')))
""")
assert cursor.fetchall() == [], "Email и адресные поля должны быть удалены из схемы БД"
cursor.close()
conn.close()
print("Проверено сопоставление повторного обращения по телефону; поля email и адреса отсутствуют в БД")

print("=" * 55)
print("CI TEST PASSED")
print("Проверены 1001 последовательных начальных ID: 1..1001.")
print("Selenium проверил форму, сохранение анкеты и связанную паспортную запись с ID анкеты 1002.")
print("=" * 55)
