import { Linking } from 'react-native';
import { ThemedText } from './ThemedText';

export function ExternalLink(props: React.ComponentProps<typeof ThemedText>) {
  return (
    <ThemedText
      {...props}
      onPress={(e) => {
        if (props.href) {
          e.preventDefault();
          Linking.openURL(props.href.toString());
        }
      }}
    />
  );
}


