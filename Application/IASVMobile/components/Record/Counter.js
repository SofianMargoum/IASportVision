import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import styles from './VideoStyles';

const Counter = () => {
  const [counter, setCounter] = useState(0);

  const increment = () => setCounter(prev => prev + 1);
  const decrement = () => setCounter(prev => Math.max(prev - 1, 0));

  return (
    <View style={styles.counterContainer}>
      <TouchableOpacity onPress={increment} style={styles.counterButton}>
        <Icon name="plus" size={20} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.counterLabel}>{counter}</Text>
      <TouchableOpacity onPress={decrement} style={styles.counterButton}>
        <Icon name="minus" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default Counter;
