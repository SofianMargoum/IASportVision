import React from 'react';
import { View, Text, Image, TextInput, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const VideoTopSection = ({
  selectedClub,
  selectedClubInfo,
  filename,
  searchResults,
  counter,
  secondCounter,
  incrementCounter,
  decrementCounter,
  incrementSecondCounter,
  decrementSecondCounter,
  handleInputChange,
  handleResultClick,
  clearSelectedClub,
  styles,
}) => (
  <>
    <View style={styles.topSection}>
      {selectedClub ? (
        <View style={styles.selectedClubInfo}>
          <Image source={{ uri: selectedClub.logo }} style={styles.selectedClubLogo} />
          <Text style={styles.selectedClubName}>{selectedClub.name}</Text>
        </View>
      ) : (
        <Text style={styles.placeholderText}>No Club Selected</Text>
      )}
      <View style={styles.counterContainer}>
        <TouchableOpacity onPress={incrementCounter} style={styles.counterButton}>
          <Icon name="plus" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.counterLabel}>{counter}</Text>
        <TouchableOpacity onPress={decrementCounter} disabled={counter === 0} style={styles.counterButton}>
          <Icon name="minus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.topSection}>
      <View>
        {selectedClubInfo ? (
          <View style={styles.selectedClubInfo}>
            <Image source={{ uri: selectedClubInfo.logo }} style={styles.selectedClubLogo} />
            <Text style={styles.selectedClubName}>{selectedClubInfo.name}</Text>
            <TouchableOpacity onPress={clearSelectedClub} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={filename}
            onChangeText={handleInputChange}
            placeholder="Rechercher un club adverse"
            placeholderTextColor="#ccc"
          />
        )}
        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.slice(0, 3).map((result, index) => (
              <TouchableOpacity key={index} onPress={() => handleResultClick(result)} style={styles.result}>
                <Image source={{ uri: result.logo }} style={styles.resultLogo} />
                <Text style={styles.resultName}>{result.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      <View style={styles.counterContainer}>
        <TouchableOpacity onPress={incrementSecondCounter} style={styles.counterButton}>
          <Icon name="plus" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.counterLabel}>{secondCounter}</Text>
        <TouchableOpacity onPress={decrementSecondCounter} disabled={secondCounter === 0} style={styles.counterButton}>
          <Icon name="minus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  </>
);

export default VideoTopSection;
