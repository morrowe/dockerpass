import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../public/style.css';

const initialValues = {
    lastName: '', firstName: '', middleName: '', birthPlace: '', birthDate: '', gender: '', phone: '',
    passportSeries: '', passportNumber: '', issueDate: '', divisionCode: '', issuedBy: '',
};

function Field({ label, name, value, onChange, type = 'text', className = '', ...props }) {
    return (
        <label className={`field ${className}`}>
            <span>{label}</span>
            <input name={name} type={type} value={value} onChange={onChange} {...props} />
        </label>
    );
}

function RegistrationForm() {
    const [values, setValues] = useState(initialValues);
    const [status, setStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);

    function update(event) {
        const { name, value, type, checked } = event.target;
        setValues(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    }

    async function submit(event) {
        event.preventDefault();
        setStatus('');
        setSubmitting(true);
        const data = { ...values };
        try {
            const response = await fetch('/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Не удалось сохранить анкету');
            setStatus(`${result.message}. ID заявки: ${result.id}.`);
            setValues(initialValues);
        } catch (error) {
            setStatus(error.message || 'Ошибка сохранения');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="registration-card">
            <header className="page-heading">
                <h1>Регистрация</h1>
            </header>

            <form onSubmit={submit}>
                <section className="form-section">
                    <h2>Личные данные</h2>
                    <div className="fields-grid">
                        <Field className="span-all" label="Фамилия" name="lastName" value={values.lastName} onChange={update} autoComplete="family-name" required />
                        <Field label="Имя" name="firstName" value={values.firstName} onChange={update} autoComplete="given-name" required />
                        <Field label="Отчество" name="middleName" value={values.middleName} onChange={update} autoComplete="additional-name" />
                        <Field className="span-all" label="Место рождения" name="birthPlace" value={values.birthPlace} onChange={update} required />
                        <Field label="Дата рождения" name="birthDate" type="date" value={values.birthDate} onChange={update} required />
                        <label className="field">
                            <span>Пол</span>
                            <select name="gender" value={values.gender} onChange={update} required>
                                <option value="" disabled>Выберите пол</option>
                                <option value="Мужской">Мужской</option>
                                <option value="Женский">Женский</option>
                                <option value="Другой">Другой</option>
                            </select>
                        </label>
                        <Field className="span-all" label="Номер телефона" name="phone" type="tel" value={values.phone} onChange={update} autoComplete="tel" placeholder="+7 (___) ___-__-__" required />
                    </div>
                </section>

                <section className="form-section">
                    <h2>Паспортные данные</h2>
                    <div className="fields-grid">
                        <Field className="span-all" label="Фамилия, Имя, Отчество" name="fullName" value={[values.lastName, values.firstName, values.middleName].filter(Boolean).join(' ')} onChange={() => {}} placeholder="Будет заполнено из личных данных" readOnly />
                        <Field label="Серия и номер паспорта" name="passportSeries" value={values.passportSeries} onChange={update} inputMode="numeric" maxLength="4" placeholder="0000" required />
                        <Field label="Номер паспорта" name="passportNumber" value={values.passportNumber} onChange={update} inputMode="numeric" maxLength="6" placeholder="000000" required />
                        <Field label="Дата рождения" name="birthDatePassport" type="date" value={values.birthDate} onChange={update} readOnly />
                        <Field className="span-all" label="Место рождения" name="birthPlacePassport" value={values.birthPlace} onChange={update} readOnly />
                        <Field label="Дата выдачи" name="issueDate" type="date" value={values.issueDate} onChange={update} required />
                        <Field label="Код подразделения" name="divisionCode" value={values.divisionCode} onChange={update} maxLength="7" placeholder="000-000" required />
                        <Field className="span-all" label="Кем выдан" name="issuedBy" value={values.issuedBy} onChange={update} required />
                    </div>
                </section>


                <button className="submit-button" type="submit" disabled={submitting}>
                    {submitting ? 'Отправка…' : 'Отправить заявку'}
                    {!submitting && <span aria-hidden="true">→</span>}
                </button>
                {status && <p id="status" className="status-message" role="status">{status}</p>}
            </form>
            <footer><span className="secure-dot" /> Данные передаются безопасно</footer>
        </main>
    );
}

createRoot(document.getElementById('root')).render(<RegistrationForm />);
