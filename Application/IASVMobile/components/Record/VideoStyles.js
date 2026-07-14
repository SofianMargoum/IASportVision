import { StyleSheet } from 'react-native';
import { moderateScale, scale, verticalScale } from '../../tools/responsive';

// Aliases courts pour la lisibilité du fichier (1 fichier de styles uniquement).
const ms = moderateScale;
const s = scale;
const vs = verticalScale;

export const SUCCESS_GREEN = '#7BC47F';
export const ACCENT_BLUE = '#1a73e8';

// Tailles du bouton record bornées pour rester ergonomiques sur petits écrans
// (ne tombe jamais sous 80dp = bonne cible tactile) et pas démesuré sur tablette.
const RECORD_OUTER = Math.max(80, Math.min(120, ms(100)));
const RECORD_INNER = Math.max(32, Math.min(48, ms(40)));
const ACTION_OUTER = Math.max(56, Math.min(76, ms(64)));

export default StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: s(10),
        backgroundColor: '#010914',
        alignItems: 'center',
    },
    notConnectedContainer: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notConnectedText: {
        fontSize: ms(18),
        color: 'red',
    },
    content: {
        flex: 1,
        width: '100%',
        backgroundColor: '#010914',
        alignItems: 'center',
    },
    bottomActionsWrapper: {
        width: '100%',
        marginTop: 'auto',
        paddingBottom: s(6),
    },
    title: {
        fontSize: ms(20),
        color: '#ffffff',
        marginBottom: s(16),
        textAlign: 'center',
        fontWeight: 'bold',
    },
    clearButton: {
        marginLeft: s(10),
        padding: s(5),
        justifyContent: 'center',
        alignItems: 'center',
    },
    clearButtonText: {
        fontSize: ms(14),
        color: '#ccc',
    },

    // --- Device status bar ---
    deviceStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: s(6),
        marginBottom: s(12),
        flexWrap: 'wrap',
    },
    deviceRefreshButton: {
        marginRight: s(8),
        flexDirection: 'row',
        alignItems: 'center',
        padding: s(4),
        borderRadius: ms(6),
    },
    deviceRefreshDisabled: {
        opacity: 0.5,
    },
    deviceNameText: {
        fontSize: ms(12),
        fontWeight: 'bold',
        marginVertical: s(8),
        marginRight: s(8),
    },
    deviceNameConnected: {
        color: SUCCESS_GREEN,
    },
    deviceNameDisconnected: {
        color: '#ff6b6b',
    },
    deviceNameChecking: {
        color: '#f1c40f',
    },
    deviceNameDefault: {
        color: 'white',
    },
    deviceStatusIcon: {
        marginLeft: s(4),
    },

    // --- Score / VS section ---
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: s(14),
        backgroundColor: '#010E1E',
        borderRadius: ms(15),
        paddingVertical: s(12),
        paddingHorizontal: s(8),
    },
    scoreTeamBlock: {
        flex: 1,
        alignItems: 'center',
    },
    scoreTeamLogo: {
        width: ms(44),
        height: ms(44),
        borderRadius: ms(8),
        marginBottom: s(6),
    },
    scoreTeamName: {
        fontSize: ms(11),
        color: '#999',
        textAlign: 'center',
        maxWidth: s(90),
    },
    scoreCenterBlock: {
        alignItems: 'center',
        paddingHorizontal: s(10),
        // minWidth en pourcentage relatif via scale, jamais en valeur fixe
        // pour ne pas pousser les blocs latéraux hors écran sur Redmi 360dp.
        minWidth: s(90),
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scoreText: {
        fontSize: ms(30),
        fontWeight: 'bold',
        color: '#ffffff',
        fontVariant: ['tabular-nums'],
    },
    scoreDash: {
        fontSize: ms(24),
        fontWeight: 'bold',
        color: '#444',
        marginHorizontal: s(6),
    },
    scoreCounterButton: {
        padding: s(6),
    },

    topSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: s(16),
        paddingVertical: s(10),
        width: '100%',
        backgroundColor: '#010E1E',
        borderRadius: ms(15),
    },
    disabledButton: {
        backgroundColor: '#ccc',
        opacity: 0.3,
    },
    selectedClubInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: ms(8),
        padding: s(10),
    },
    selectedClubLogo: {
        width: ms(28),
        height: ms(28),
        marginRight: s(8),
        borderRadius: ms(5),
    },
    selectedClubName: {
        fontSize: ms(14),
        color: '#ffffff',
        fontWeight: '500',
    },
    placeholderText: {
        color: '#666',
        fontSize: ms(12),
        paddingLeft: s(12),
        fontStyle: 'italic',
    },
    counterContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        borderRadius: ms(8),
        padding: s(10),
    },
    counterButton: {
        padding: s(5),
    },
    counterLabel: {
        fontSize: ms(18),
        fontWeight: 'bold',
        color: '#ffffff',
        marginHorizontal: s(10),
    },
    inputContainer: {
        marginTop: s(16),
    },
    input: {
        color: '#ccc',
        padding: s(10),
        fontSize: ms(14),
        borderRadius: ms(5),
    },
    searchResults: {
        maxHeight: vs(150),
        borderRadius: ms(8),
        padding: s(10),
    },
    result: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: s(5),
    },
    resultLogo: {
        width: ms(28),
        height: ms(28),
        marginRight: s(8),
        borderRadius: ms(5),
    },
    resultName: {
        color: '#ffffff',
        fontSize: ms(14),
    },

    // --- Timer ---
    timer: {
        marginTop: s(16),
        alignItems: 'center',
        backgroundColor: '#0d1b2a',
        paddingVertical: s(10),
        paddingHorizontal: s(24),
        borderRadius: ms(12),
        borderWidth: 1,
        borderColor: '#1a2d45',
    },
    timerText: {
        fontSize: ms(28),
        color: '#ffffff',
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
    },
    timerRecordingDot: {
        width: ms(10),
        height: ms(10),
        borderRadius: ms(5),
        backgroundColor: '#ff4444',
        marginTop: s(6),
    },

    message: {
        marginTop: s(16),
        alignItems: 'center',
    },
    messageText: {
        color: '#ff4d4d',
    },
    messageTextSuccess: {
        color: SUCCESS_GREEN,
    },

    progressWrapper: {
        marginTop: s(16),
        width: '100%',
        alignSelf: 'stretch',
        paddingHorizontal: 0,
    },
    progressHeader: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: s(6),
    },
    progressPercentText: {
        fontSize: ms(11),
        color: '#9aa0a6',
    },
    progressBarBg: {
        width: '100%',
        alignSelf: 'stretch',
        height: ms(8),
        borderRadius: ms(8),
        backgroundColor: '#010E1E',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#0b1a33',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#ffffff',
    },
    progressMessages: {
        marginTop: s(8),
    },
    progressMessageText: {
        fontSize: ms(11),
        color: '#9aa0a6',
    },
    pendingListWrapper: {
        width: '100%',
        marginTop: s(12),
        paddingHorizontal: s(4),
    },
    pendingListTitle: {
        fontSize: ms(12),
        color: '#9aa0a6',
        marginBottom: s(6),
    },
    pendingItem: {
        marginBottom: s(10),
        paddingVertical: s(6),
        paddingHorizontal: s(8),
        backgroundColor: '#0b1a33',
        borderRadius: ms(6),
    },
    pendingItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: s(4),
    },
    pendingItemLabel: {
        flex: 1,
        fontSize: ms(12),
        color: '#ffffff',
    },
    pendingItemLabelDone: {
        color: '#7be07b',
    },
    pendingItemLabelError: {
        color: '#ff8a8a',
    },
    pendingItemCloseBtn: {
        marginLeft: s(8),
        paddingHorizontal: s(6),
    },
    pendingItemCloseTxt: {
        color: '#9aa0a6',
        fontSize: ms(16),
        fontWeight: 'bold',
    },
    pendingItemBarBg: {
        height: ms(4),
        borderRadius: ms(4),
        backgroundColor: '#010E1E',
        overflow: 'hidden',
    },
    pendingItemBarFill: {
        height: '100%',
        backgroundColor: '#4aa3ff',
    },
    pendingItemBarFillDone: {
        backgroundColor: '#4ec06b',
    },
    pendingItemBarFillError: {
        backgroundColor: '#ff6b6b',
    },
    pendingItemStatus: {
        marginTop: s(4),
        fontSize: ms(10),
        color: '#9aa0a6',
    },
    buttonContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: s(10),
    },
    sideActionSlotLeft: {
        flex: 1,
        alignItems: 'flex-end',
        paddingRight: s(12),
    },
    sideActionSlotRight: {
        flex: 1,
        alignItems: 'flex-start',
        paddingLeft: s(12),
    },
    sideActionButton: {
        width: ACTION_OUTER,
        height: ACTION_OUTER,
        borderRadius: ACTION_OUTER / 2,
        backgroundColor: '#061425',
        borderWidth: 1,
        borderColor: '#10253e',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: s(8),
        paddingVertical: s(8),
        opacity: 0.9,
    },
    sideActionButtonStack: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    sideActionButtonText: {
        color: '#b5c2d2',
        fontSize: ms(9),
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: ms(12),
    },
    sideActionButtonLabel: {
        color: '#b5c2d2',
        fontSize: ms(7.8),
        fontWeight: '600',
        textAlign: 'center',
        marginTop: s(4),
        lineHeight: ms(10),
    },

    outerCircle: {
        width: RECORD_OUTER,
        height: RECORD_OUTER,
        borderRadius: RECORD_OUTER / 2,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: ms(5),
        borderColor: 'black',
        backgroundColor: 'white',
    },
    defaultOuter: {
        borderColor: 'black',
    },
    recordingOuter: {
        borderColor: 'red',
    },
    innerCircle: {
        width: RECORD_INNER,
        height: RECORD_INNER,
        borderRadius: RECORD_INNER / 2,
    },
    defaultInner: {
        backgroundColor: 'red',
    },
    recordingInner: {
        backgroundColor: 'black',
    },

    settingsOverlay: {
        flex: 1,
        backgroundColor: 'rgba(1, 9, 20, 0.78)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: s(18),
    },
    settingsCard: {
        width: '100%',
        maxWidth: ms(360),
        borderRadius: ms(18),
        backgroundColor: '#010E1E',
        borderWidth: 1,
        borderColor: '#1a2d45',
        padding: s(16),
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    settingsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: s(14),
    },
    settingsTitle: {
        color: '#ffffff',
        fontSize: ms(18),
        fontWeight: '700',
    },
    settingsCloseButton: {
        width: ms(32),
        height: ms(32),
        borderRadius: ms(16),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b1a33',
        borderWidth: 1,
        borderColor: '#1a2d45',
    },
    settingsCloseText: {
        color: '#ffffff',
        fontSize: ms(18),
        lineHeight: ms(20),
        fontWeight: '700',
    },
    settingsList: {
    },
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: s(10),
        paddingHorizontal: s(12),
        borderRadius: ms(12),
        backgroundColor: '#010914',
        borderWidth: 1,
        borderColor: '#0b1a33',
        marginBottom: s(12),
    },
    settingsRowLabel: {
        color: '#ffffff',
        fontSize: ms(13),
        fontWeight: '600',
    },

    // --- Hint camera offline ---
    hintText: {
        color: '#bbb',
        marginTop: s(10),
        textAlign: 'center',
        fontSize: ms(12),
    },
});
