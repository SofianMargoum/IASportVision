// components/styles.js
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenWrapper: {
    flex: 1,
    backgroundColor: 'black',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoWrapper: {
    backgroundColor: 'black',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  centerButtonContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayButton: {
    backgroundColor: 'transparent',
    padding: 20,
    borderRadius: 50,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 24,
    gap: 10,
  },
  timeText: {
    color: 'white',
    fontSize: 14,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  fullScreenButton: {
    padding: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchLabel: {
    color: 'white',
    fontSize: 12,
  },
});

export default styles;
