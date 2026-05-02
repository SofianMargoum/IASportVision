// components/styles.js
import { StyleSheet } from 'react-native';
import { moderateScale, scale as s } from './../../../tools/responsive';

const ms = moderateScale;

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
    padding: s(20),
    borderRadius: ms(50),
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(10),
    paddingBottom: s(24),
    gap: s(10),
  },
  timeText: {
    color: 'white',
    fontSize: ms(13),
  },
  slider: {
    flex: 1,
    height: ms(40),
  },
  fullScreenButton: {
    padding: s(8),
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  switchLabel: {
    color: 'white',
    fontSize: ms(11),
  },
});

export default styles;
