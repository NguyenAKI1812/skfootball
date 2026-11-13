import { supabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEY = 'sk_football_online_account';

async function hashPassword(password) {
  const normalized = String(password || '');
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const data = new TextEncoder().encode(normalized);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return btoa(unescape(encodeURIComponent(normalized)));
}

export function getSavedAccount() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAccountLocally(account) {
  if (typeof window === 'undefined') return;
  if (account) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function logoutAccount() {
  saveAccountLocally(null);
}

export async function registerAccount({ username, password, displayName }) {
  const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  const cleanName = displayName.trim();
  if (cleanUser.length < 3) {
    throw new Error('Tên đăng nhập cần ít nhất 3 ký tự (chữ/số).');
  }
  if (!password || password.length < 4) {
    throw new Error('Mật khẩu cần ít nhất 4 ký tự.');
  }
  if (!cleanName) {
    throw new Error('Vui lòng nhập tên hiển thị.');
  }

  const passwordHash = await hashPassword(password);

  if (isSupabaseConfigured && supabase) {
    const { data: existing, error: checkErr } = await supabase
      .from('player_profiles')
      .select('id')
      .eq('username', cleanUser)
      .maybeSingle();

    if (checkErr) {
      throw new Error('Chưa tạo bảng player_profiles trên Supabase hoặc lỗi kết nối.');
    }
    if (existing) {
      throw new Error('Tên đăng nhập đã tồn tại, hãy chọn tên khác hoặc Đăng nhập.');
    }

    const { data, error } = await supabase
      .from('player_profiles')
      .insert({
        username: cleanUser,
        password_hash: passwordHash,
        display_name: cleanName
      })
      .select('id, username, display_name, avatar')
      .single();

    if (error) {
      throw new Error(error.message || 'Không thể tạo tài khoản.');
    }

    const account = {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      avatar: data.avatar || '⚽'
    };
    saveAccountLocally(account);
    return account;
  }

  const localAcc = {
    id: `local-${cleanUser}`,
    username: cleanUser,
    displayName: cleanName,
    avatar: '⚽'
  };
  saveAccountLocally(localAcc);
  return localAcc;
}

export async function loginAccount({ username, password }) {
  const cleanUser = username.trim().toLowerCase();
  if (!cleanUser || !password) {
    throw new Error('Vui lòng nhập tên đăng nhập và mật khẩu.');
  }

  const passwordHash = await hashPassword(password);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('player_profiles')
      .select('id, username, password_hash, display_name, avatar')
      .eq('username', cleanUser)
      .maybeSingle();

    if (error) {
      throw new Error('Lỗi kết nối Supabase hoặc chưa chạy SQL tạo bảng player_profiles.');
    }
    if (!data) {
      throw new Error('Không tìm thấy tài khoản này.');
    }
    if (data.password_hash !== passwordHash) {
      throw new Error('Mật khẩu không đúng.');
    }

    const account = {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      avatar: data.avatar || '⚽'
    };
    saveAccountLocally(account);
    return account;
  }

  throw new Error('Chưa cấu hình Supabase, hãy tạo tài khoản mới ở chế độ Local.');
}

export async function updateAccountDisplayName(account, newDisplayName) {
  const cleanName = newDisplayName.trim();
  if (!cleanName) {
    throw new Error('Tên hiển thị không được để trống.');
  }

  if (isSupabaseConfigured && supabase && account?.id && !String(account.id).startsWith('local-')) {
    const { data, error } = await supabase
      .from('player_profiles')
      .update({ display_name: cleanName })
      .eq('id', account.id)
      .select('id, username, display_name, avatar')
      .single();

    if (error) {
      throw new Error(error.message || 'Không thể cập nhật tên.');
    }

    const updated = {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      avatar: data.avatar || '⚽'
    };
    saveAccountLocally(updated);
    return updated;
  }

  const updated = { ...account, displayName: cleanName };
  saveAccountLocally(updated);
  return updated;
}
