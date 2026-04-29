import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const scale = 0.85;

export const SUCCESS_GREEN = '#7BC47F';
export const ACCENT_BLUE = '#1a73e8';

export default StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 10,
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
        fontSize: 18,
        color: 'red',
    },
    content: {
        flex: 1,
        width: '100%',
        backgroundColor: '#010914',
        alignItems: 'center',
    },
    title: {
        fontSize: 24 * scale,
        color: '#ffffff',
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    clearButton: {
        marginLeft: 10,
        padding: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    clearButtonText: {
        fontSize: 14,
        color: '#ccc',
    },

    // --- Device status bar ---
    deviceStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    deviceRefreshButton: {
        marginRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 4,
        borderRadius: 6,
    },
    deviceRefreshDisabled: {
        opacity: 0.5,
    },
    deviceNameText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginVertical: 10,
        marginRight: 8,
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
        marginLeft: 4,
    },

    // --- Score / VS section ---
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 16,
        backgroundColor: '#010E1E',
        borderRadius: 15,
        paddingVertical: 14,
        paddingHorizontal: 8,
    },
    scoreTeamBlock: {
        flex: 1,
        alignItems: 'center',
    },
    scoreTeamLogo: {
        width: 44,
        height: 44,
        borderRadius: 8,
        marginBottom: 6,
    },
    scoreTeamName: {
        fontSize: 11,
        color: '#999',
        textAlign: 'center',
        maxWidth: 90,
    },
    scoreCenterBlock: {
        alignItems: 'center',
        paddingHorizontal: 10,
        minWidth: 100,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scoreText: {
        fontSize: 34,
        fontWeight: 'bold',
        color: '#ffffff',
        fontVariant: ['tabular-nums'],
    },
    scoreDash: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#444',
        marginHorizontal: 8,
    },
    scoreCounterButton: {
        padding: 6,
    },

    topSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 10,
        width: '100%',
        backgroundColor: '#010E1E',
        borderRadius: 15,
    },
    disabledButton: {
        backgroundColor: '#ccc',
        opacity: 0.3,
    },
    selectedClubInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        padding: 10,
    },
    selectedClubLogo: {
        width: 30 * scale,
        height: 30 * scale,
        marginRight: 10,
        borderRadius: 5,
    },
    selectedClubName: {
        fontSize: 15,
        color: '#ffffff',
        fontWeight: '500',
    },
    placeholderText: {
        color: '#666',
        fontSize: 13,
        paddingLeft: 12,
        fontStyle: 'italic',
    },
    counterContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        borderRadius: 8,
        padding: 10,
    },
    counterButton: {
        padding: 5,
    },
    counterLabel: {
        fontSize: 20 * scale,
        fontWeight: 'bold',
        color: '#ffffff',
        marginHorizontal: 10,
    },
    inputContainer: {
        marginTop: 20,
    },
    input: {
        color: '#ccc',
        padding: 10,
        fontSize: 16 * scale,
        borderRadius: 5,
    },
    searchResults: {
        maxHeight: 150,
        borderRadius: 8,
        padding: 10,
    },
    result: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
    },
    resultLogo: {
        width: 30 * scale,
        height: 30 * scale,
        marginRight: 10,
        borderRadius: 5,
    },
    resultName: {
        color: '#ffffff',
        fontSize: 16 * scale,
    },

    // --- Timer ---
    timer: {
        marginTop: 20,
        alignItems: 'center',
        backgroundColor: '#0d1b2a',
        paddingVertical: 10,
        paddingHorizontal: 28,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1a2d45',
    },
    timerText: {
        fontSize: 30,
        color: '#ffffff',
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
    },
    timerRecordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ff4444',
        marginTop: 6,
    },

    message: {
        marginTop: 20,
        alignItems: 'center',
    },
    messageText: {
        color: '#ff4d4d',
    },
    messageTextSuccess: {
        color: SUCCESS_GREEN,
    },

    progressWrapper: {
        marginTop: 16,
        width: '100%',
        alignSelf: 'stretch',
        paddingHorizontal: 0,
    },
    progressHeader: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 6,
    },
    progressPercentText: {
        fontSize: 11,
        color: '#9aa0a6',
    },
    progressBarBg: {
        width: '100%',
        alignSelf: 'stretch',
        height: 8,
        borderRadius: 8,
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
        marginTop: 8,
    },
    progressMessageText: {
        fontSize: 11,
        color: '#9aa0a6',
    },
    pendingListWrapper: {
        width: '100%',
        marginTop: 12,
        paddingHorizontal: 4,
    },
    pendingListTitle: {
        fontSize: 12,
        color: '#9aa0a6',
        marginBottom: 6,
    },
    pendingItem: {
        marginBottom: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#0b1a33',
        borderRadius: 6,
    },
    pendingItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    pendingItemLabel: {
        flex: 1,
        fontSize: 12,
        color: '#ffffff',
    },
    pendingItemLabelDone: {
        color: '#7be07b',
    },
    pendingItemLabelError: {
        color: '#ff8a8a',
    },
    pendingItemCloseBtn: {
        marginLeft: 8,
        paddingHorizontal: 6,
    },
    pendingItemCloseTxt: {
        color: '#9aa0a6',
        fontSize: 16,
        fontWeight: 'bold',
    },
    pendingItemBarBg: {
        height: 4,
        borderRadius: 4,
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
        marginTop: 4,
        fontSize: 10,
        color: '#9aa0a6',
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flex: 1,
        marginTop: 20,
    },

    outerCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 5,
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
        width: 40,
        height: 40,
        borderRadius: 25,
    },
    defaultInner: {
        backgroundColor: 'red',
    },
    recordingInner: {
        backgroundColor: 'black',
    },

    // --- Hint camera offline ---
    hintText: {
        color: '#bbb',
        marginTop: 10,
        textAlign: 'center',
        fontSize: 12,
    },
});
