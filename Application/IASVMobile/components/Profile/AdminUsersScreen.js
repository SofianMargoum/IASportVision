import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { moderateScale, scale as s } from './../../tools/responsive';
import {
  createUser,
  deactivateUser,
  listUsers,
  updateUser,
} from './../../tools/adminApi';

const ms = moderateScale;

const ROLE_OPTIONS = ['coach', 'player', 'supporter', 'admin'];

const EMPTY_FORM = {
  username: '',
  password: '',
  name: '',
  email: '',
  role: 'player',
  clubId: '',
  photoAsset: '',
  isActive: true,
};

const AdminUsersScreen = ({ user, onBack }) => {
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null => création
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const list = await listUsers();
      setUsers(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.message || 'Erreur de chargement');
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [isAdmin, refresh]);

  const handlePullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 2500);
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditorVisible(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setForm({
      username: u.username || '',
      password: '',
      name: u.name || '',
      email: u.email || '',
      role: u.role || 'player',
      clubId: u.clubId || u.club_id || '',
      photoAsset: u.photoAsset || u.photo_asset || '',
      isActive: u.isActive !== undefined ? !!u.isActive : !!u.is_active,
    });
    setFormError(null);
    setEditorVisible(true);
  };

  const closeEditor = () => {
    if (submitting) return;
    setEditorVisible(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const validateForm = () => {
    if (!form.username.trim()) return 'Username requis.';
    if (!form.name.trim()) return 'Nom requis.';
    if (!ROLE_OPTIONS.includes(form.role)) return 'Rôle invalide.';
    if (!editingUser && (!form.password || form.password.length < 8)) {
      return 'Mot de passe requis (8 caractères minimum).';
    }
    if (editingUser && form.password && form.password.length < 8) {
      return 'Le mot de passe doit faire au moins 8 caractères.';
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      return 'Email invalide.';
    }
    return null;
  };

  const buildPayload = () => {
    const payload = {
      username: form.username.trim(),
      name: form.name.trim(),
      role: form.role,
      isActive: !!form.isActive,
    };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.clubId.trim()) payload.clubId = form.clubId.trim();
    if (form.photoAsset.trim()) payload.photoAsset = form.photoAsset.trim();
    if (form.password) payload.password = form.password;
    return payload;
  };

  const handleSubmit = async () => {
    const v = validateForm();
    if (v) { setFormError(v); return; }
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editingUser) {
        await updateUser(editingUser.id, payload);
        flashSuccess('Utilisateur mis à jour.');
      } else {
        await createUser(payload);
        flashSuccess('Utilisateur créé.');
      }
      setEditorVisible(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (e) {
      setFormError(e?.message || 'Erreur serveur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = (u) => {
    if (u.id === user?.id) {
      Alert.alert('Action refusée', 'Vous ne pouvez pas vous désactiver vous-même.');
      return;
    }
    Alert.alert(
      'Désactiver cet utilisateur ?',
      `${u.name || u.username} ne pourra plus se connecter.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivateUser(u.id);
              flashSuccess('Utilisateur désactivé.');
              await refresh();
            } catch (e) {
              Alert.alert('Erreur', e?.message || 'Impossible de désactiver.');
            }
          },
        },
      ],
    );
  };

  // ---------- Garde-fou rôle ----------
  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="chevron-back" size={ms(22)} color="#C5D0DC" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gestion utilisateurs</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.deniedBox}>
          <Icon name="lock-closed-outline" size={ms(40)} color="#FF6B6B" />
          <Text style={styles.deniedText}>Accès refusé.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="chevron-back" size={ms(22)} color="#C5D0DC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion utilisateurs</Text>
        <TouchableOpacity onPress={openCreate} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="add" size={ms(24)} color="#7FB6FF" />
        </TouchableOpacity>
      </View>

      {success && (
        <View style={styles.banner}>
          <Text style={styles.bannerSuccessText}>{success}</Text>
        </View>
      )}
      {error && (
        <View style={[styles.banner, styles.bannerError]}>
          <Text style={styles.bannerErrorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.createButton} onPress={openCreate} activeOpacity={0.8}>
        <Icon name="person-add-outline" size={ms(18)} color="#7FB6FF" />
        <Text style={styles.createButtonText}>Créer un utilisateur</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#7FB6FF" /></View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handlePullToRefresh}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucun utilisateur.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={styles.userTopLine}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.name || item.username}
                  </Text>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: (item.isActive ?? item.is_active) ? '#4CAF50' : '#888' },
                  ]} />
                </View>
                <Text style={styles.userMeta} numberOfLines={1}>
                  @{item.username} · {item.role}
                </Text>
                {!!item.email && (
                  <Text style={styles.userMeta} numberOfLines={1}>{item.email}</Text>
                )}
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEdit(item)}
                  activeOpacity={0.7}
                >
                  <Icon name="create-outline" size={ms(18)} color="#7FB6FF" />
                </TouchableOpacity>
                {(item.isActive ?? item.is_active) && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionDanger]}
                    onPress={() => handleDeactivate(item)}
                    activeOpacity={0.7}
                  >
                    <Icon name="ban-outline" size={ms(18)} color="#FF6B6B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={editorVisible}
        animationType="slide"
        transparent
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingUser ? 'Modifier' : 'Créer un utilisateur'}
              </Text>
              <TouchableOpacity onPress={closeEditor} disabled={submitting}>
                <Icon name="close" size={ms(22)} color="#C5D0DC" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll}>
              <Field
                label="Username *"
                value={form.username}
                onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
                autoCapitalize="none"
                editable={!editingUser}
              />
              <Field
                label={editingUser ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe *'}
                value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                secureTextEntry
                placeholder={editingUser ? 'Laisser vide pour ne pas changer' : ''}
              />
              <Field
                label="Nom *"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <Field
                label="Email"
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.fieldLabel}>Rôle *</Text>
              <View style={styles.rolesRow}>
                {ROLE_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.rolePill, form.role === r && styles.rolePillActive]}
                    onPress={() => setForm((f) => ({ ...f, role: r }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.rolePillText,
                      form.role === r && styles.rolePillTextActive,
                    ]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Field
                label="Club ID (optionnel)"
                value={form.clubId}
                onChangeText={(v) => setForm((f) => ({ ...f, clubId: v }))}
                autoCapitalize="none"
              />
              <Field
                label="Photo asset (optionnel)"
                value={form.photoAsset}
                onChangeText={(v) => setForm((f) => ({ ...f, photoAsset: v }))}
                autoCapitalize="none"
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Actif</Text>
                <Switch
                  value={!!form.isActive}
                  onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                  trackColor={{ false: '#333', true: '#2F8CFF' }}
                  thumbColor="#fff"
                />
              </View>

              {!!formError && <Text style={styles.formError}>{formError}</Text>}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.footerBtn, styles.footerBtnGhost]}
                onPress={closeEditor}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.footerBtnGhostText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, styles.footerBtnPrimary, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.footerBtnPrimaryText}>
                    {editingUser ? 'Enregistrer' : 'Créer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const Field = ({ label, ...inputProps }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, inputProps.editable === false && styles.inputDisabled]}
      placeholderTextColor="#5A6B7E"
      autoCorrect={false}
      {...inputProps}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000814' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(12),
    paddingVertical: s(10),
    borderBottomWidth: 1,
    borderBottomColor: '#1A2D45',
  },
  backBtn: { width: ms(36), height: ms(36), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: ms(16), fontWeight: '700' },
  banner: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingVertical: s(8),
    paddingHorizontal: s(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 175, 80, 0.3)',
  },
  bannerError: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderBottomColor: 'rgba(255, 107, 107, 0.3)',
  },
  bannerSuccessText: { color: '#A5E6A8', fontSize: ms(13) },
  bannerErrorText: { color: '#FF9C9C', fontSize: ms(13) },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: s(16),
    paddingVertical: s(12),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: 'rgba(127, 182, 255, 0.4)',
    backgroundColor: 'rgba(47, 140, 255, 0.08)',
    gap: s(8),
  },
  createButtonText: { color: '#7FB6FF', fontSize: ms(15), fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: s(16), paddingBottom: s(24) },
  emptyText: { color: '#5A6B7E', textAlign: 'center', marginTop: s(40) },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s(12),
    backgroundColor: '#010E1E',
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#1A2D45',
    marginBottom: s(10),
  },
  userInfo: { flex: 1 },
  userTopLine: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  userName: { color: '#fff', fontSize: ms(15), fontWeight: '700', flexShrink: 1 },
  statusDot: { width: ms(8), height: ms(8), borderRadius: ms(4) },
  userMeta: { color: '#7A8A9C', fontSize: ms(12), marginTop: s(2) },
  userActions: { flexDirection: 'row', gap: s(8) },
  actionBtn: {
    width: ms(36), height: ms(36),
    alignItems: 'center', justifyContent: 'center',
    borderRadius: ms(8),
    borderWidth: 1, borderColor: '#1A2D45',
    backgroundColor: '#000814',
  },
  actionDanger: { borderColor: 'rgba(255, 107, 107, 0.4)' },
  deniedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(12) },
  deniedText: { color: '#FF6B6B', fontSize: ms(16), fontWeight: '600' },

  // Modal
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#000814',
    borderTopLeftRadius: ms(16),
    borderTopRightRadius: ms(16),
    maxHeight: '92%',
    borderWidth: 1, borderColor: '#1A2D45',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: s(16),
    borderBottomWidth: 1, borderBottomColor: '#1A2D45',
  },
  modalTitle: { color: '#fff', fontSize: ms(16), fontWeight: '700' },
  formScroll: { padding: s(16), paddingBottom: s(24) },
  field: { marginBottom: s(12) },
  fieldLabel: { color: '#9FB1C7', fontSize: ms(12), marginBottom: s(6) },
  input: {
    backgroundColor: '#010E1E',
    color: '#fff',
    borderWidth: 1, borderColor: '#1A2D45',
    borderRadius: ms(8),
    paddingHorizontal: s(12),
    paddingVertical: Platform.OS === 'ios' ? s(12) : s(8),
    fontSize: ms(14),
  },
  inputDisabled: { opacity: 0.6 },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s(8), marginBottom: s(12) },
  rolePill: {
    paddingHorizontal: s(12), paddingVertical: s(6),
    borderRadius: ms(16),
    borderWidth: 1, borderColor: '#1A2D45',
    backgroundColor: '#010E1E',
  },
  rolePillActive: {
    borderColor: '#7FB6FF',
    backgroundColor: 'rgba(47, 140, 255, 0.15)',
  },
  rolePillText: { color: '#9FB1C7', fontSize: ms(12), fontWeight: '600' },
  rolePillTextActive: { color: '#7FB6FF' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginVertical: s(8),
  },
  formError: { color: '#FF6B6B', fontSize: ms(13), marginTop: s(8) },
  modalFooter: {
    flexDirection: 'row', gap: s(10),
    padding: s(16),
    borderTopWidth: 1, borderTopColor: '#1A2D45',
  },
  footerBtn: {
    flex: 1,
    paddingVertical: s(12),
    borderRadius: ms(10),
    alignItems: 'center', justifyContent: 'center',
  },
  footerBtnGhost: { borderWidth: 1, borderColor: '#1A2D45' },
  footerBtnGhostText: { color: '#C5D0DC', fontSize: ms(14), fontWeight: '600' },
  footerBtnPrimary: { backgroundColor: '#2F8CFF' },
  footerBtnPrimaryText: { color: '#fff', fontSize: ms(14), fontWeight: '700' },
});

export default AdminUsersScreen;
