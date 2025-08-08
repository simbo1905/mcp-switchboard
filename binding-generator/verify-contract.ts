import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import * as ts from 'typescript';

interface TypeContract {
  structs: Map<string, Set<string>>;  // struct_name -> field_names
  enums: Map<string, Set<string>>;    // enum_name -> variant_names
  types: Set<string>;                  // all type names
}

function extractRustTypes(): TypeContract {
  // Parse Rust source files directly (stable approach)
  const rustSource = readFileSync('../mcp-core/src/lib.rs', 'utf-8');
  const buildInfoSource = readFileSync('../mcp-core/src/build_info.rs', 'utf-8');
  const allRustSource = rustSource + '\n' + buildInfoSource;
  
  const contract: TypeContract = {
    structs: new Map(),
    enums: new Map(),
    types: new Set()
  };

  // Extract structs with #[derive(TS)]
  const structRegex = /#\[derive\([^)]*TS[^)]*\)\]\s*#\[ts\(export\)\]\s*pub struct (\w+)\s*\{([^}]+)\}/g;
  let match;
  while ((match = structRegex.exec(allRustSource)) !== null) {
    const structName = match[1];
    const body = match[2];
    const fields = new Set<string>();
    
    // Extract field names
    const fieldRegex = /pub\s+(\w+):/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      fields.add(fieldMatch[1]);
    }
    
    contract.structs.set(structName, fields);
    contract.types.add(structName);
  }

  // Extract enums with #[derive(TS)]
  const enumRegex = /#\[derive\([^)]*TS[^)]*\)\]\s*#\[ts\(export\)\]\s*pub enum (\w+)\s*\{([^}]+)\}/g;
  while ((match = enumRegex.exec(allRustSource)) !== null) {
    const enumName = match[1];
    const body = match[2];
    const variants = new Set<string>();
    
    // Extract variant names
    const variantRegex = /(\w+)(?:\([^)]*\)|\{[^}]*\}|,)/g;
    let variantMatch;
    while ((variantMatch = variantRegex.exec(body)) !== null) {
      if (variantMatch[1] && variantMatch[1] !== '') {
        variants.add(variantMatch[1]);
      }
    }
    
    contract.enums.set(enumName, variants);
    contract.types.add(enumName);
  }

  return contract;
}

function extractTypeScriptTypes(): TypeContract {
  const tsSource = readFileSync('../mcp-switchboard-ui/src/bindings.ts', 'utf-8');
  const contract: TypeContract = {
    structs: new Map(),
    enums: new Map(),
    types: new Set()
  };

  // Parse TypeScript AST for accurate extraction
  const sourceFile = ts.createSourceFile(
    'bindings.ts',
    tsSource,
    ts.ScriptTarget.Latest,
    true
  );

  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      const typeName = node.name.text;
      contract.types.add(typeName);

      if (ts.isInterfaceDeclaration(node)) {
        const fields = new Set<string>();
        node.members.forEach(member => {
          if (ts.isPropertySignature(member) && member.name) {
            fields.add(member.name.getText());
          }
        });
        contract.structs.set(typeName, fields);
      } else if (ts.isTypeAliasDeclaration(node) && node.type) {
        // Check if it's an object type (struct-like)
        if (ts.isTypeLiteralNode(node.type)) {
          const fields = new Set<string>();
          node.type.members.forEach(member => {
            if (ts.isPropertySignature(member) && member.name) {
              fields.add(member.name.getText());
            }
          });
          contract.structs.set(typeName, fields);
        }
        // Check if it's a union type (enum-like)
        else if (ts.isUnionTypeNode(node.type)) {
          const variants = new Set<string>();
          node.type.types.forEach(type => {
            if (ts.isLiteralTypeNode(type) && type.literal) {
              variants.add(type.literal.getText().replace(/['"]/g, ''));
            } else if (ts.isTypeLiteralNode(type)) {
              // Handle object variants like { "Content": string }
              type.members.forEach(member => {
                if (ts.isPropertySignature(member) && member.name) {
                  const variantName = member.name.getText().replace(/['"]/g, '');
                  variants.add(variantName);
                }
              });
            }
          });
          if (variants.size > 0) {
            contract.enums.set(typeName, variants);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return contract;
}

function compareContracts(rust: TypeContract, typescript: TypeContract): boolean {
  let success = true;
  const errors: string[] = [];

  // Check all Rust types exist in TypeScript
  rust.types.forEach(typeName => {
    if (!typescript.types.has(typeName)) {
      errors.push(`❌ Missing type in TypeScript: ${typeName}`);
      success = false;
    }
  });

  // Check struct fields match
  rust.structs.forEach((rustFields, structName) => {
    const tsFields = typescript.structs.get(structName);
    if (!tsFields) {
      errors.push(`❌ Struct ${structName} missing in TypeScript`);
      success = false;
    } else {
      rustFields.forEach(field => {
        if (!tsFields.has(field)) {
          errors.push(`❌ Field '${field}' missing in TypeScript struct ${structName}`);
          success = false;
        }
      });
      // Check for extra fields in TypeScript
      tsFields.forEach(field => {
        if (!rustFields.has(field)) {
          errors.push(`⚠️  Extra field '${field}' in TypeScript struct ${structName}`);
        }
      });
    }
  });

  // Check enum variants match
  rust.enums.forEach((rustVariants, enumName) => {
    const tsVariants = typescript.enums.get(enumName);
    if (!tsVariants) {
      errors.push(`❌ Enum ${enumName} missing in TypeScript`);
      success = false;
    } else {
      rustVariants.forEach(variant => {
        if (!tsVariants.has(variant)) {
          errors.push(`❌ Variant '${variant}' missing in TypeScript enum ${enumName}`);
          success = false;
        }
      });
    }
  });

  // Report results
  console.log('📊 Contract Verification Report:');
  console.log(`   Rust types: ${rust.types.size}`);
  console.log(`   TypeScript types: ${typescript.types.size}`);
  console.log(`   Rust structs: ${rust.structs.size}`);
  console.log(`   TypeScript structs: ${typescript.structs.size}`);
  console.log(`   Rust enums: ${rust.enums.size}`);
  console.log(`   TypeScript enums: ${typescript.enums.size}`);

  if (errors.length > 0) {
    console.log('\n⚠️  Contract Violations:');
    errors.forEach(error => console.log(`   ${error}`));
  }

  if (success) {
    console.log('\n✅ Contract verification passed! Types match.');
  } else {
    console.log('\n❌ Contract verification failed! Types do not match.');
  }

  return success;
}

// Main execution
try {
  const rustContract = extractRustTypes();
  const tsContract = extractTypeScriptTypes();
  const success = compareContracts(rustContract, tsContract);
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error('❌ Contract verification error:', error);
  process.exit(1);
}