// auth.js - работа с Supabase

document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ auth.js загружен");

    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    // Переключение вкладок
    if (loginTab) {
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        });
    }

    if (registerTab) {
        registerTab.addEventListener('click', () => {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.add('active');
            loginForm.classList.remove('active');
        });
    }

    // ===== РЕГИСТРАЦИЯ =====
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log("📝 Регистрация...");

            const firstName = document.getElementById('registerFirstName').value.trim();
            const lastName = document.getElementById('registerLastName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;

            // Проверки
            if (!firstName || !lastName || !email || !password) {
                alert("Заполните все поля!");
                return;
            }

            if (password !== confirmPassword) {
                alert("Пароли не совпадают!");
                return;
            }

            if (password.length < 6) {
                alert("Пароль должен быть минимум 6 символов");
                return;
            }

            try {
                // Инициализируем Supabase
                const supabase = window.supabase.createClient(
                    window.SUPABASE_URL,
                    window.SUPABASE_KEY
                );

                // 1. Регистрируем пользователя в Supabase Auth
                const { data: authData, error: signUpError } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            first_name: firstName,
                            last_name: lastName
                        }
                    }
                });

                if (signUpError) throw signUpError;

                console.log("✅ Пользователь создан в Auth, id:", authData.user.id);

                // 2. Сохраняем данные в таблицу users
                const { error: insertError } = await supabase
                    .from('users')
                    .insert({
                        id: authData.user.id,
                        email: email,
                        first_name: firstName,
                        last_name: lastName,
                        role: 'user'
                    });

                if (insertError) {
                    console.error("Ошибка вставки в users:", insertError);
                    // Если ошибка из-за RLS, показываем понятное сообщение
                    if (insertError.code === '42501') {
                        alert("Ошибка прав доступа. Пожалуйста, выполните в Supabase SQL: ALTER TABLE users DISABLE ROW LEVEL SECURITY;");
                        return;
                    }
                    throw insertError;
                }

                console.log("✅ Данные сохранены в таблицу users");

                // 3. Сохраняем в localStorage
                localStorage.setItem('travelUser', JSON.stringify({
                    id: authData.user.id,
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    role: 'user'
                }));
                
                localStorage.setItem('travelToken', authData.session?.access_token || 'manual');

                alert("🎉 Аккаунт успешно создан!");
                window.location.href = "index.html";

            } catch (error) {
                console.error("❌ Ошибка регистрации:", error);
                alert("Ошибка: " + error.message);
            }
        });
    }

    // ===== ВХОД =====
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log("🔐 Вход...");

            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            if (!email || !password) {
                alert("Введите email и пароль!");
                return;
            }

            try {
                const supabase = window.supabase.createClient(
                    window.SUPABASE_URL,
                    window.SUPABASE_KEY
                );

                // Вход через Supabase Auth
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) throw error;

                console.log("✅ Авторизация успешна, user.id:", data.user.id);

                // Получаем данные пользователя из таблицы users (исправленный запрос)
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', data.user.id)
                    .maybeSingle();  // ← ИЗМЕНЕНО: вместо .single() используем .maybeSingle()

                // Если пользователь не найден в таблице, создаем его
                if (userError || !userData) {
                    console.log("Пользователь не найден в таблице, создаем...");
                    
                    // Создаем запись в таблице users
                    const { error: insertError } = await supabase
                        .from('users')
                        .insert({
                            id: data.user.id,
                            email: email,
                            first_name: 'Пользователь',
                            last_name: '',
                            role: 'user'
                        });
                    
                    if (insertError) {
                        console.error("Ошибка создания пользователя:", insertError);
                        // Если ошибка из-за RLS, показываем понятное сообщение
                        if (insertError.code === '42501') {
                            alert("Ошибка прав доступа. Пожалуйста, выполните в Supabase SQL: ALTER TABLE users DISABLE ROW LEVEL SECURITY;");
                            return;
                        }
                        throw insertError;
                    }
                    
                    // Получаем созданные данные
                    const { data: newUserData, error: newUserError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', data.user.id)
                        .maybeSingle();
                    
                    if (newUserError) throw newUserError;
                    
                    // Сохраняем в localStorage
                    localStorage.setItem('travelUser', JSON.stringify({
                        id: data.user.id,
                        firstName: newUserData?.first_name || 'Пользователь',
                        lastName: newUserData?.last_name || '',
                        email: email,
                        role: newUserData?.role || 'user',
                        avatar: newUserData?.avatar
                    }));
                    
                    localStorage.setItem('travelToken', data.session.access_token);
                    
                    alert("✅ Вход выполнен успешно!");
                    window.location.href = "index.html";
                    return;
                }

                console.log("✅ Данные пользователя получены:", userData);

                // Сохраняем в localStorage
                localStorage.setItem('travelUser', JSON.stringify({
                    id: data.user.id,
                    firstName: userData.first_name,
                    lastName: userData.last_name,
                    email: userData.email,
                    role: userData.role || 'user',
                    avatar: userData.avatar
                }));
                
                localStorage.setItem('travelToken', data.session.access_token);

                alert("✅ Вход выполнен успешно!");
                window.location.href = "index.html";

            } catch (error) {
                console.error("❌ Ошибка входа:", error);
                alert("Ошибка: " + error.message);
            }
        });
    }
});

// Глобальная функция выхода
window.logoutUser = async function() {
    try {
        const supabase = window.supabase.createClient(
            window.SUPABASE_URL,
            window.SUPABASE_KEY
        );
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Ошибка выхода:", error);
    }
    localStorage.removeItem('travelUser');
    localStorage.removeItem('travelToken');
    window.location.href = 'index.html';
};