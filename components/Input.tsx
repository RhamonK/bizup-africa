import { ReactNode } from 'react'
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native'
import { Colors } from '../constants/colors'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  hint?: string
  rightSlot?: ReactNode   // bouton/icône affiché à droite du champ (ex: afficher mot de passe)
}

export function Input({ label, error, hint, style, rightSlot, ...props }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            rightSlot ? styles.inputWithSlot : null,
            error && styles.inputError,
            style,
          ]}
          placeholderTextColor={Colors.textTertiary}
          {...props}
        />
        {rightSlot && <View style={styles.rightSlot}>{rightSlot}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  inputRow: { position: 'relative', justifyContent: 'center' },
  inputWithSlot: { paddingRight: 46 },
  rightSlot: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  error: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.danger,
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textSecondary,
  },
})
